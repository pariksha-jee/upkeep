import { Inject, Injectable } from '@nestjs/common';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { connect as tcpConnect } from 'node:net';
import { lookup } from 'node:dns/promises';
import {
  advance,
  isPrivateHostnameLiteral,
  type MonitorStatus,
  type MonitorType,
} from '@upkeep/core';
import { PrismaService } from '../shared/prisma.service.js';
import { logger } from '../shared/logger.js';
import { SshTunnelManager } from './ssh-manager.js';
import { OpenVpnManager } from './openvpn-manager.js';
import type { TunnelCoreRow } from './credential-resolver.js';
import { NOTIFICATIONS_QUEUE_TOKEN, type NotificationJobData, type QueueLike } from './queues.js';

export interface CheckOutcome {
  ok: boolean;
  responseTimeMs: number | null;
  statusCode: number | null;
  error: string | null;
}

interface MonitorRow {
  id: string;
  userId: string;
  name: string;
  type: MonitorType;
  target: string;
  port: number | null;
  method: string | null;
  headers: unknown;
  body: string | null;
  keyword: string | null;
  expectedStatusCodes: number[] | null;
  intervalSeconds: number;
  timeoutMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  enabled: boolean;
  status: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  tunnelId: string | null;
}

const MAX_BODY_SCAN = 256 * 1024;

/**
 * Executes a single check round for a monitor and drives the state machine:
 * record Check → advance → open/resolve Incident → enqueue notifications.
 * Used by the worker dispatcher AND the API's test-now endpoint.
 */
@Injectable()
export class CheckExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ssh: SshTunnelManager,
    private readonly vpn: OpenVpnManager,
    @Inject(NOTIFICATIONS_QUEUE_TOKEN)
    private readonly notifications: QueueLike<NotificationJobData>,
  ) {}

  async executeMonitor(
    monitorId: string,
    opts: { trigger: 'scheduled' | 'manual' },
  ): Promise<{
    outcome: CheckOutcome;
    status: MonitorStatus;
    transition: 'none' | 'went-down' | 'went-up';
  } | null> {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      include: { tunnel: true },
    });
    if (monitor === null) return null;
    if (!monitor.enabled || monitor.status === 'PAUSED') {
      if (opts.trigger === 'scheduled') return null;
    }

    const outcome =
      monitor.type === 'HTTP'
        ? await this.httpCheck(monitor).catch((err: unknown) => this.failOutcome(err))
        : await this.tcpCheck(monitor).catch((err: unknown) => this.failOutcome(err));

    const checkedAt = new Date();
    await this.prisma.check.create({
      data: {
        monitorId: monitor.id,
        status: outcome.ok ? 'UP' : 'DOWN',
        ...(outcome.responseTimeMs !== null ? { responseTimeMs: outcome.responseTimeMs } : {}),
        ...(outcome.statusCode !== null ? { statusCode: outcome.statusCode } : {}),
        ...(outcome.error !== null ? { error: outcome.error.slice(0, 512) } : {}),
        checkedAt,
      },
    });

    const next = advance({
      status: monitor.status,
      counters: {
        consecutiveFailures: monitor.consecutiveFailures,
        consecutiveSuccesses: monitor.consecutiveSuccesses,
      },
      ok: outcome.ok,
      failureThreshold: monitor.failureThreshold,
      recoveryThreshold: monitor.recoveryThreshold,
    });

    await this.prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        status: next.status,
        consecutiveFailures: next.counters.consecutiveFailures,
        consecutiveSuccesses: next.counters.consecutiveSuccesses,
        lastCheckedAt: checkedAt,
        nextCheckAt: monitor.enabled
          ? new Date(checkedAt.getTime() + monitor.intervalSeconds * 1000)
          : null,
      },
    });

    if (next.transition === 'went-down') {
      const incident = await this.prisma.incident.create({
        data: {
          monitorId: monitor.id,
          status: 'OPEN',
          cause:
            outcome.statusCode !== null
              ? `HTTP ${outcome.statusCode}`
              : (outcome.error ?? 'check failed'),
          lastError: outcome.error,
        },
      });
      await this.enqueueNotifications(monitor, incident.id, 'DOWN');
      logger.warn({ monitorId: monitor.id, incidentId: incident.id }, 'monitor went DOWN');
    } else if (next.transition === 'went-up') {
      const open = await this.prisma.incident.findFirst({
        where: { monitorId: monitor.id, status: 'OPEN' },
      });
      if (open !== null) {
        await this.prisma.incident.update({
          where: { id: open.id },
          data: { status: 'RESOLVED', resolvedAt: new Date() },
        });
      }
      await this.enqueueNotifications(monitor, open?.id ?? null, 'RECOVERY');
      logger.info({ monitorId: monitor.id }, 'monitor recovered');
    }

    return { outcome, status: next.status, transition: next.transition };
  }

  private failOutcome(err: unknown): CheckOutcome {
    return {
      ok: false,
      responseTimeMs: null,
      statusCode: null,
      error: err instanceof Error ? err.message : 'check failed',
    };
  }

  // ─── HTTP ────────────────────────────────────────────────────────────────

  private async httpCheck(
    monitor: MonitorRow & { tunnel: TunnelCoreRow | null },
  ): Promise<CheckOutcome> {
    const url = new URL(monitor.target);
    let host = url.hostname;
    let port = url.port.length > 0 ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
    let servername: string | undefined;
    const useTls = url.protocol === 'https:';

    if (monitor.tunnel !== null) {
      if (monitor.tunnel.type === 'SSH') {
        const localPort = await this.ssh.ensureForward(monitor.tunnel, host, port);
        host = '127.0.0.1';
        port = localPort;
        servername = url.hostname; // SNI + cert validation against the real host
      } else {
        await this.vpn.ensureRoute(monitor.tunnel, host);
      }
    } else {
      // Connect-time SSRF guard (DNS rebinding defense — security review #1).
      const guard = await this.directHostGuard(host);
      if (guard !== null) return guard;
    }

    const headers: Record<string, string> = {
      ...(isRecord(monitor.headers) ? (monitor.headers as Record<string, string>) : {}),
      host: url.hostname,
      'user-agent': 'Upkeep/1.0 (+https://upkeep.dev)',
    };

    const started = Date.now();
    return new Promise<CheckOutcome>((resolve) => {
      const options: RequestOptions = {
        host,
        port,
        method: monitor.method ?? 'GET',
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: monitor.timeoutMs,
        ...(servername !== undefined ? { servername } : {}),
      };
      const req = (useTls ? httpsRequest : httpRequest)(options, (res) => {
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        let received = 0;
        res.on('data', (chunk: Buffer) => {
          if (monitor.keyword !== null && received < MAX_BODY_SCAN) {
            chunks.push(chunk);
            received += chunk.length;
          }
        });
        res.on('end', () => {
          const elapsed = Date.now() - started;
          const expected = monitor.expectedStatusCodes;
          const statusOk =
            expected !== null && expected.length > 0
              ? expected.includes(status)
              : status >= 200 && status < 300;
          let keywordOk = true;
          if (monitor.keyword !== null) {
            const body = Buffer.concat(chunks).toString('utf8');
            keywordOk = body.includes(monitor.keyword);
          }
          res.resume();
          resolve({
            ok: statusOk && keywordOk,
            responseTimeMs: elapsed,
            statusCode: status,
            error: !statusOk
              ? `unexpected status ${status}`
              : !keywordOk
                ? `keyword "${monitor.keyword}" not found`
                : null,
          });
        });
        res.on('error', () =>
          resolve({
            ok: false,
            responseTimeMs: Date.now() - started,
            statusCode: status,
            error: 'response stream error',
          }),
        );
      });
      req.on('timeout', () => {
        req.destroy(new Error(`timeout after ${monitor.timeoutMs}ms`));
      });
      req.on('error', (err) => {
        resolve({
          ok: false,
          responseTimeMs: Date.now() - started,
          statusCode: null,
          error: err.message,
        });
      });
      if (
        monitor.body !== null &&
        monitor.method !== null &&
        monitor.method !== 'GET' &&
        monitor.method !== 'HEAD'
      ) {
        req.write(monitor.body);
      }
      req.end();
    });
  }

  // ─── TCP ─────────────────────────────────────────────────────────────────

  private async tcpCheck(
    monitor: MonitorRow & { tunnel: TunnelCoreRow | null },
  ): Promise<CheckOutcome> {
    let host = monitor.target;
    let port = monitor.port ?? 80;

    if (monitor.tunnel !== null) {
      if (monitor.tunnel.type === 'SSH') {
        const localPort = await this.ssh.ensureForward(monitor.tunnel, host, port);
        host = '127.0.0.1';
        port = localPort;
      } else {
        await this.vpn.ensureRoute(monitor.tunnel, host);
      }
    } else {
      const guard = await this.directHostGuard(host);
      if (guard !== null) return guard;
    }

    const started = Date.now();
    return new Promise<CheckOutcome>((resolve) => {
      const sock = tcpConnect({ host, port });
      const done = (ok: boolean, error: string | null): void => {
        sock.destroy();
        resolve({
          ok,
          responseTimeMs: Date.now() - started,
          statusCode: null,
          error,
        });
      };
      sock.setTimeout(monitor.timeoutMs, () => done(false, `timeout after ${monitor.timeoutMs}ms`));
      sock.once('connect', () => done(true, null));
      sock.once('error', (err: NodeJS.ErrnoException) => done(false, err.message));
    });
  }

  /** Returns a failing outcome when a DIRECT target resolves privately. */
  private async directHostGuard(host: string): Promise<CheckOutcome | null> {
    if (isPrivateHostnameLiteral(host)) {
      return {
        ok: false,
        responseTimeMs: null,
        statusCode: null,
        error: 'private target rejected — attach a tunnel to monitor internal endpoints',
      };
    }
    try {
      const records = await lookup(host, { all: true });
      if (records.some((r) => isPrivateHostnameLiteral(r.address))) {
        return {
          ok: false,
          responseTimeMs: null,
          statusCode: null,
          error:
            'target resolves to a private address — attach a tunnel to monitor internal endpoints',
        };
      }
    } catch {
      // DNS failure here will surface as a connect error in the check itself.
    }
    return null;
  }

  private async enqueueNotifications(
    monitor: { id: string; userId: string },
    incidentId: string | null,
    event: 'DOWN' | 'RECOVERY',
  ): Promise<void> {
    const bindings = await this.prisma.alertBinding.findMany({
      where: { monitorId: monitor.id },
    });
    const jobs: NotificationJobData[] = bindings
      .filter((b) => (event === 'DOWN' ? b.notifyOnDown : b.notifyOnRecovery))
      .map((b) => ({
        monitorId: monitor.id,
        userId: monitor.userId,
        incidentId,
        channelId: b.channelId,
        event,
      }));
    // Push notifications go to all registered devices of the user.
    jobs.push({
      monitorId: monitor.id,
      userId: monitor.userId,
      incidentId,
      channelId: null,
      event,
    });
    if (jobs.length > 0) {
      // Checks must never fail because the queue is unavailable — log and move on.
      await this.notifications
        .addBulk(jobs.map((data) => ({ name: 'notify', data })))
        .catch((err: unknown) => {
          logger.error({ err, monitorId: monitor.id }, 'failed to enqueue notifications');
        });
    }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
