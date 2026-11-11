import { Injectable } from '@nestjs/common';
import {
  STATS_WINDOWS,
  type CheckDto,
  type ListChecksQuery,
  type MonitorStatsDto,
  type StatsWindow,
} from '@upkeep/core';
import { Prisma } from '@upkeep/db';
import { PrismaService } from '../../shared/prisma.service.js';
import { NotFoundError } from '../../shared/errors.js';

interface RawBucket {
  bucket: Date;
  total: bigint;
  up: bigint;
  avg_ms: number | null;
  min_ms: number | null;
  max_ms: number | null;
}

const BUCKET_SPEC: Record<StatsWindow, { trunc: 'minute' | 'hour' | 'day'; count: number }> = {
  '1h': { trunc: 'minute', count: 60 },
  '24h': { trunc: 'hour', count: 24 },
  '7d': { trunc: 'hour', count: 168 },
  '30d': { trunc: 'day', count: 30 },
  '90d': { trunc: 'day', count: 90 },
};

@Injectable()
export class ChecksService {
  constructor(private readonly prisma: PrismaService) {}

  async listChecks(userId: string, monitorId: string, query: ListChecksQuery): Promise<CheckDto[]> {
    await this.assertMonitorOwned(userId, monitorId);
    const rows = await this.prisma.check.findMany({
      where: {
        monitorId,
        ...(query.before !== undefined ? { checkedAt: { lt: new Date(query.before) } } : {}),
      },
      orderBy: { checkedAt: 'desc' },
      take: query.limit,
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      monitorId: r.monitorId,
      status: r.status,
      responseTimeMs: r.responseTimeMs,
      statusCode: r.statusCode,
      error: r.error,
      checkedAt: r.checkedAt.toISOString(),
    }));
  }

  /**
   * Window statistics straight from a single date_trunc GROUP BY — no reliance
   * on the hourly aggregate job, correct even on fresh installs.
   */
  async stats(userId: string, monitorId: string, window: StatsWindow): Promise<MonitorStatsDto> {
    await this.assertMonitorOwned(userId, monitorId);
    const windowSeconds = STATS_WINDOWS[window];
    const end = new Date();
    const start = new Date(end.getTime() - windowSeconds * 1000);
    const spec = BUCKET_SPEC[window];

    const rows: RawBucket[] = await this.prisma.$queryRaw(
      Prisma.sql`
        SELECT
          date_trunc(${spec.trunc}, checked_at) AS bucket,
          count(*)::bigint AS total,
          count(*) FILTER (WHERE status = 'UP')::bigint AS up,
          avg(response_time_ms) FILTER (WHERE status = 'UP')::float8 AS avg_ms,
          min(response_time_ms)::int AS min_ms,
          max(response_time_ms)::int AS max_ms
        FROM "Check"
        WHERE monitor_id = ${monitorId} AND checked_at >= ${start} AND checked_at < ${end}
        GROUP BY 1
        ORDER BY 1
      `,
    );

    const byStart = new Map<number, { total: number; up: number; avgMs: number | null }>();
    let totalChecks = 0;
    let failedChecks = 0;
    let minMs: number | null = null;
    let maxMs: number | null = null;
    let weightedSum = 0;
    let weightedCount = 0;

    for (const row of rows) {
      const total = Number(row.total);
      const up = Number(row.up);
      totalChecks += total;
      failedChecks += total - up;
      if (row.min_ms !== null) minMs = minMs === null ? row.min_ms : Math.min(minMs, row.min_ms);
      if (row.max_ms !== null) maxMs = maxMs === null ? row.max_ms : Math.max(maxMs, row.max_ms);
      if (row.avg_ms !== null && up > 0) {
        weightedSum += row.avg_ms * up;
        weightedCount += up;
      }
      byStart.set(row.bucket.getTime(), { total, up, avgMs: row.avg_ms });
    }

    // Build UTC-aligned buckets matching date_trunc boundaries (epoch multiples
    // of the step are exactly those boundaries), zero-filled where no checks ran.
    const stepMs =
      spec.trunc === 'minute' ? 60_000 : spec.trunc === 'hour' ? 3_600_000 : 86_400_000;
    const firstBucket = Math.floor(start.getTime() / stepMs) * stepMs;
    const buckets: Array<{ start: string; total: number; up: number; avgMs: number | null }> = [];
    for (
      let ts = firstBucket;
      ts < end.getTime() && buckets.length <= spec.count + 1;
      ts += stepMs
    ) {
      const hit = byStart.get(ts);
      buckets.push({
        start: new Date(ts).toISOString(),
        total: hit?.total ?? 0,
        up: hit?.up ?? 0,
        avgMs: hit?.avgMs ?? null,
      });
    }

    return {
      window,
      uptimeRatio:
        totalChecks === 0
          ? 1
          : Math.round(((totalChecks - failedChecks) / totalChecks) * 10000) / 10000,
      avgResponseMs: weightedCount > 0 ? Math.round(weightedSum / weightedCount) : null,
      minResponseMs: minMs,
      maxResponseMs: maxMs,
      totalChecks,
      failedChecks,
      buckets,
    };
  }

  private async assertMonitorOwned(userId: string, monitorId: string): Promise<void> {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id: monitorId, userId },
      select: { id: true },
    });
    if (monitor === null) throw new NotFoundError('Monitor');
  }
}
