import { Controller, Get } from '@nestjs/common';
import type { SummaryDto } from '@upkeep/core';
import { CurrentUser, type SessionUser } from '../../common/decorators.js';
import { PrismaService } from '../../shared/prisma.service.js';

@Controller('summary')
export class SummaryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async summary(@CurrentUser() user: SessionUser): Promise<SummaryDto> {
    const [monitors, openIncidents, recentIncidents] = await Promise.all([
      this.prisma.monitor.groupBy({
        by: ['status'],
        where: { userId: user.id },
        _count: { _all: true },
      }),
      this.prisma.incident.count({
        where: { status: 'OPEN', monitor: { userId: user.id } },
      }),
      this.prisma.incident.findMany({
        where: { monitor: { userId: user.id } },
        orderBy: { startedAt: 'desc' },
        take: 5,
        include: { monitor: { select: { name: true } } },
      }),
    ]);

    const counts = { total: 0, up: 0, down: 0, paused: 0, pending: 0 };
    for (const g of monitors) {
      const n = g._count._all;
      counts.total += n;
      if (g.status === 'UP') counts.up += n;
      else if (g.status === 'DOWN') counts.down += n;
      else if (g.status === 'PAUSED') counts.paused += n;
      else counts.pending += n;
    }

    // Worst monitors by 24h uptime (monitors with checks only).
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const monitorRows = await this.prisma.monitor.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    });
    const ids = monitorRows.map((m) => m.id);
    const worst: Array<{ id: string; name: string; uptime24h: number | null }> = [];
    if (ids.length > 0) {
      const [totals, ups] = await Promise.all([
        this.prisma.check.groupBy({
          by: ['monitorId'],
          where: { monitorId: { in: ids }, checkedAt: { gte: since } },
          _count: { _all: true },
        }),
        this.prisma.check.groupBy({
          by: ['monitorId'],
          where: { monitorId: { in: ids }, checkedAt: { gte: since }, status: 'UP' },
          _count: { _all: true },
        }),
      ]);
      for (const m of monitorRows) {
        const total = totals.find((t) => t.monitorId === m.id)?._count._all;
        if (total === undefined) {
          worst.push({ id: m.id, name: m.name, uptime24h: null });
          continue;
        }
        const up = ups.find((u) => u.monitorId === m.id)?._count._all ?? 0;
        worst.push({
          id: m.id,
          name: m.name,
          uptime24h: Math.round((up / total) * 10000) / 10000,
        });
      }
    }
    worst.sort((a, b) => (a.uptime24h ?? 2) - (b.uptime24h ?? 2));

    return {
      monitors: counts,
      openIncidents,
      worstMonitors: worst.slice(0, 5),
      recentIncidents: recentIncidents.map((r) => ({
        id: r.id,
        monitorId: r.monitorId,
        monitorName: r.monitor.name,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        cause: r.cause,
        lastError: r.lastError,
      })),
    };
  }
}
