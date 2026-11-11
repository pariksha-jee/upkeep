import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import { PrismaService } from '../shared/prisma.service.js';
import { logger } from '../shared/logger.js';
import { env } from '../config/env.js';
import { MAINTENANCE_QUEUE, bullRedis } from '../worker-core/queues.js';
import { TunnelsService } from '../modules/tunnels/tunnels.service.js';

type MaintenanceJobName = 'aggregate' | 'retention' | 'sweep';

/**
 * Maintenance jobs (BullMQ repeatable):
 * - aggregate (hourly): roll raw checks into CheckAggregate
 * - retention (daily): purge checks older than CHECK_RETENTION_DAYS, stale
 *   refresh tokens, ancient notification logs
 * - sweep (hourly): mark tunnels with expired signed URLs EXPIRED
 */
@Injectable()
export class MaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tunnels: TunnelsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const connection = bullRedis();

    // bullmq v6: repeatable jobs are registered as job schedulers (idempotent
    // by scheduler id — same pattern re-registers cleanly on every boot).
    const queue = new Queue(MAINTENANCE_QUEUE, { connection });
    await queue.upsertJobScheduler('aggregate', { pattern: '5 * * * *' }, { name: 'aggregate' });
    await queue.upsertJobScheduler('retention', { pattern: '17 3 * * *' }, { name: 'retention' });
    await queue.upsertJobScheduler('sweep', { pattern: '25 * * * *' }, { name: 'sweep' });
    await queue.close();

    this.worker = new Worker<MaintenanceJobName>(
      MAINTENANCE_QUEUE,
      async (job: Job) => {
        switch (job.name as MaintenanceJobName) {
          case 'aggregate':
            await this.aggregate();
            break;
          case 'retention':
            await this.retention();
            break;
          case 'sweep':
            await this.sweep();
            break;
          default:
            logger.warn({ job: job.name }, 'unknown maintenance job');
        }
      },
      { connection, concurrency: 1 },
    );
    logger.info('maintenance worker started (aggregate/retention/sweep)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  /** Roll the last 2 hours of checks into hourly buckets (catches overlap). */
  private async aggregate(): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "CheckAggregate" ("monitorId", "bucketStart", "total", "failed", "minMs", "maxMs", "sumMs")
      SELECT
        "monitorId",
        date_trunc('hour', "checkedAt") AS bucket,
        count(*)::int,
        count(*) FILTER (WHERE "status" = 'DOWN')::int,
        min("responseTimeMs")::int,
        max("responseTimeMs")::int,
        COALESCE(sum("responseTimeMs") FILTER (WHERE "status" = 'UP'), 0)::bigint
      FROM "Check"
      WHERE "checkedAt" >= now() - interval '2 hours'
      GROUP BY 1, 2
      ON CONFLICT ("monitorId", "bucketStart") DO UPDATE SET
        "total" = EXCLUDED."total",
        "failed" = EXCLUDED."failed",
        "minMs" = EXCLUDED."minMs",
        "maxMs" = EXCLUDED."maxMs",
        "sumMs" = EXCLUDED."sumMs"
    `;
  }

  private async retention(): Promise<void> {
    const cutoff = new Date(Date.now() - env.CHECK_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    // Batched deletes (deleteMany has no LIMIT — raw ctid batches avoid long locks).
    let deleted = 0;
    for (;;) {
      const batch = await this.prisma.$executeRaw`
        DELETE FROM "Check" WHERE ctid IN (
          SELECT ctid FROM "Check" WHERE "checkedAt" < ${cutoff} LIMIT 10000
        )
      `;
      deleted += batch;
      if (batch < 10_000) break;
    }
    await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
        ],
      },
    });
    await this.prisma.notificationLog.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
    });
    await this.prisma.checkAggregate.deleteMany({
      where: { bucketStart: { lt: new Date(Date.now() - 730 * 24 * 3600 * 1000) } },
    });
    logger.info({ deleted, retentionDays: env.CHECK_RETENTION_DAYS }, 'retention purge complete');
  }

  private async sweep(): Promise<void> {
    const expired = await this.tunnels.sweepExpirations();
    if (expired > 0) {
      logger.info({ expired }, 'tunnels marked EXPIRED (signed URL lapse)');
    }
  }
}
