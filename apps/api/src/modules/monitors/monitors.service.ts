import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import {
  LIMITS,
  isPrivateHostnameLiteral,
  hostnameOf,
  uptimeRatio,
  type BindingDto,
  type BindingsUpdateInput,
  type CreateMonitorInput,
  type ListMonitorsQuery,
  type MonitorDetailDto,
  type MonitorDto,
  type UpdateMonitorInput,
} from '@upkeep/core';
import { PrismaService } from '../../shared/prisma.service.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import { paginate, type Paginated } from '../../common/pagination.js';
import { toBindingDto, toMonitorDetailDto, toMonitorDto } from './monitors.mapper.js';
import type { Prisma } from '@upkeep/db';

@Injectable()
export class MonitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateMonitorInput): Promise<MonitorDetailDto> {
    const count = await this.prisma.monitor.count({ where: { userId } });
    if (count >= LIMITS.monitorsPerUser) {
      throw new ConflictError(`Monitor limit reached (${LIMITS.monitorsPerUser})`);
    }
    await this.assertTunnelOwned(userId, input.tunnelId ?? null);
    await this.assertChannelsOwned(userId, input.channelIds);
    await this.assertDirectTargetAllowed(input);

    const created = await this.prisma.monitor.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        target: input.target,
        ...(input.type === 'TCP' ? { port: input.port } : {}),
        ...(input.type === 'HTTP'
          ? {
              method: input.method,
              ...(input.headers !== undefined
                ? { headers: input.headers as Prisma.InputJsonValue }
                : {}),
              ...(input.body !== undefined ? { body: input.body } : {}),
              ...(input.keyword !== undefined ? { keyword: input.keyword } : {}),
              ...(input.expectedStatusCodes !== undefined
                ? { expectedStatusCodes: input.expectedStatusCodes }
                : {}),
            }
          : {}),
        intervalSeconds: input.intervalSeconds,
        timeoutMs: input.timeoutMs,
        failureThreshold: input.failureThreshold,
        recoveryThreshold: input.recoveryThreshold,
        ...(input.tunnelId !== undefined && input.tunnelId !== null
          ? { tunnelId: input.tunnelId }
          : {}),
        nextCheckAt: new Date(),
        ...(input.channelIds.length > 0
          ? {
              bindings: {
                create: input.channelIds.map((channelId) => ({ channelId })),
              },
            }
          : {}),
      },
      include: { bindings: { include: { channel: true } } },
    });
    return toMonitorDetailDto(created);
  }

  async list(
    userId: string,
    query: ListMonitorsQuery,
  ): Promise<Paginated<MonitorDto & { uptime24h: number | null }>> {
    const where: Prisma.MonitorWhereInput = {
      userId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.type !== undefined ? { type: query.type } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.monitor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.monitor.count({ where }),
    ]);

    const uptimes = await this.uptime24hBatch(rows.map((r) => r.id));
    const items = rows.map((r): MonitorDto & { uptime24h: number | null } => ({
      ...toMonitorDto(r),
      uptime24h: uptimes[r.id] ?? null,
    }));
    return paginate(items, query.page, query.limit, total);
  }

  /** One group-by pair per page of monitors — keeps the dashboard cheap. */
  private async uptime24hBatch(monitorIds: string[]): Promise<Record<string, number>> {
    if (monitorIds.length === 0) return {};
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totals, ups] = await Promise.all([
      this.prisma.check.groupBy({
        by: ['monitorId'],
        where: { monitorId: { in: monitorIds }, checkedAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.check.groupBy({
        by: ['monitorId'],
        where: { monitorId: { in: monitorIds }, checkedAt: { gte: since }, status: 'UP' },
        _count: { _all: true },
      }),
    ]);
    const result: Record<string, number> = {};
    for (const t of totals) {
      const up = ups.find((u) => u.monitorId === t.monitorId)?._count._all ?? 0;
      // Round to 4 decimals for the wire.
      result[t.monitorId] = Math.round(uptimeRatio(up, t._count._all) * 10000) / 10000;
    }
    return result;
  }

  async get(userId: string, id: string): Promise<MonitorDetailDto> {
    const row = await this.prisma.monitor.findFirst({
      where: { id, userId },
      include: { bindings: { include: { channel: true } } },
    });
    if (row === null) throw new NotFoundError('Monitor');
    return toMonitorDetailDto(row);
  }

  async update(userId: string, id: string, input: UpdateMonitorInput): Promise<MonitorDetailDto> {
    const existing = await this.prisma.monitor.findFirst({ where: { id, userId } });
    if (existing === null) throw new NotFoundError('Monitor');
    if (input.tunnelId !== undefined) {
      await this.assertTunnelOwned(userId, input.tunnelId);
    }
    if (input.channelIds !== undefined) {
      await this.assertChannelsOwned(userId, input.channelIds);
    }

    await this.prisma.monitor.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.intervalSeconds !== undefined ? { intervalSeconds: input.intervalSeconds } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.failureThreshold !== undefined
          ? { failureThreshold: input.failureThreshold }
          : {}),
        ...(input.recoveryThreshold !== undefined
          ? { recoveryThreshold: input.recoveryThreshold }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.tunnelId !== undefined ? { tunnelId: input.tunnelId } : {}),
        ...(input.method !== undefined ? { method: input.method } : {}),
        ...(input.headers !== undefined
          ? { headers: (input.headers ?? undefined) as Prisma.InputJsonValue | undefined }
          : {}),
        ...(input.body !== undefined ? { body: input.body ?? null } : {}),
        ...(input.keyword !== undefined ? { keyword: input.keyword ?? null } : {}),
        ...(input.expectedStatusCodes !== undefined
          ? { expectedStatusCodes: input.expectedStatusCodes ?? [] }
          : {}),
        // Interval changes take effect from the next scheduled check.
        ...(input.intervalSeconds !== undefined ? { nextCheckAt: new Date() } : {}),
      },
    });
    if (input.channelIds !== undefined) {
      await this.replaceBindings(
        id,
        input.channelIds.map((channelId) => ({ channelId })),
      );
    }
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.monitor.findFirst({ where: { id, userId } });
    if (existing === null) throw new NotFoundError('Monitor');
    await this.prisma.monitor.delete({ where: { id } });
  }

  async pause(userId: string, id: string): Promise<MonitorDetailDto> {
    const existing = await this.prisma.monitor.findFirst({ where: { id, userId } });
    if (existing === null) throw new NotFoundError('Monitor');
    await this.prisma.$transaction([
      this.prisma.monitor.update({
        where: { id },
        data: {
          enabled: false,
          status: 'PAUSED',
          nextCheckAt: null,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
        },
      }),
      this.prisma.incident.updateMany({
        where: { monitorId: id, status: 'OPEN' },
        data: { status: 'RESOLVED', resolvedAt: new Date(), cause: 'paused' },
      }),
    ]);
    return this.get(userId, id);
  }

  async resume(userId: string, id: string): Promise<MonitorDetailDto> {
    const existing = await this.prisma.monitor.findFirst({ where: { id, userId } });
    if (existing === null) throw new NotFoundError('Monitor');
    await this.prisma.monitor.update({
      where: { id },
      data: {
        enabled: true,
        status: 'PENDING',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        nextCheckAt: new Date(),
      },
    });
    return this.get(userId, id);
  }

  async updateBindings(
    userId: string,
    monitorId: string,
    inputs: BindingsUpdateInput,
  ): Promise<BindingDto[]> {
    const monitor = await this.prisma.monitor.findFirst({ where: { id: monitorId, userId } });
    if (monitor === null) throw new NotFoundError('Monitor');
    await this.assertChannelsOwned(
      userId,
      inputs.map((b) => b.channelId),
    );
    const created = await this.replaceBindings(monitorId, inputs);
    return created.map((row) => toBindingDto(row));
  }

  private async replaceBindings(
    monitorId: string,
    inputs: Array<{
      channelId: string;
      notifyOnDown?: boolean;
      notifyOnRecovery?: boolean;
      cooldownMinutes?: number;
    }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.alertBinding.deleteMany({ where: { monitorId } });
      if (inputs.length > 0) {
        await tx.alertBinding.createMany({
          data: inputs.map((b) => ({
            monitorId,
            channelId: b.channelId,
            notifyOnDown: b.notifyOnDown ?? true,
            notifyOnRecovery: b.notifyOnRecovery ?? true,
            cooldownMinutes: b.cooldownMinutes ?? 5,
          })),
        });
      }
      return tx.alertBinding.findMany({
        where: { monitorId },
        include: { channel: true },
      });
    });
  }

  /**
   * SSRF guard (security review #1/#2): direct-route monitors may not target
   * private/loopback hosts — that would let a user probe the API host's
   * internal network. Private targets are legal only through an owned tunnel.
   * Literal check first, then DNS resolution (re-checked at connect time by
   * the engine to defeat DNS rebinding).
   */
  private async assertDirectTargetAllowed(input: CreateMonitorInput): Promise<void> {
    if (input.tunnelId !== undefined && input.tunnelId !== null) return;
    const host = input.type === 'HTTP' ? (hostnameOf(input.target) ?? '') : input.target;
    if (isPrivateHostnameLiteral(host)) {
      throw new ValidationError([
        { path: 'target', message: 'private/loopback targets require an SSH or OpenVPN tunnel' },
      ]);
    }
    try {
      const records = await lookup(host, { all: true });
      if (records.some((r) => isPrivateHostnameLiteral(r.address))) {
        throw new ValidationError([
          {
            path: 'target',
            message:
              'target resolves to a private address — attach a tunnel to monitor internal endpoints',
          },
        ]);
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      // Unresolvable hosts are allowed (may resolve inside a tunnel later, or
      // DNS may be flaky) — the check engine will report failures.
    }
  }

  private async assertTunnelOwned(userId: string, tunnelId: string | null): Promise<void> {
    if (tunnelId === null || tunnelId === undefined) return;
    const tunnel = await this.prisma.tunnel.findFirst({ where: { id: tunnelId, userId } });
    if (tunnel === null) {
      throw new ForbiddenError('Tunnel not found or not owned by this account');
    }
  }

  private async assertChannelsOwned(userId: string, channelIds: string[]): Promise<void> {
    if (channelIds.length === 0) return;
    const unique = [...new Set(channelIds)];
    const owned = await this.prisma.channel.count({
      where: { userId, id: { in: unique } },
    });
    if (owned !== unique.length) {
      throw new ValidationError([
        { path: 'channelIds', message: 'one or more channels do not exist for this account' },
      ]);
    }
  }
}
