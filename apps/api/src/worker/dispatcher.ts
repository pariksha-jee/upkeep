import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service.js';
import { logger } from '../shared/logger.js';
import { CHECKS_QUEUE_TOKEN, type ChecksJobData, type QueueLike } from '../worker-core/queues.js';

const TICK_MS = 5_000;
const BATCH = 100;

/**
 * Claims due monitors atomically (FOR UPDATE SKIP LOCKED — safe with N
 * workers) and enqueues one check job per monitor. Job IDs dedupe per
 * interval period; a stale-due self-heal resets monitors whose previous job
 * was lost (crash between claim and completion).
 */
@Injectable()
export class DispatcherService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHECKS_QUEUE_TOKEN) private readonly checksQueue: QueueLike<ChecksJobData>,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    void this.tick();
    logger.info('dispatcher started (5s tick)');
  }

  onModuleDestroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const claimed = await this.prisma.$queryRaw<
        Array<{ id: string; next_check_at: Date; interval_seconds: number }>
      >`
        UPDATE "Monitor" AS m SET "nextCheckAt" = now() + (m."intervalSeconds" || ' seconds')::interval
        WHERE m."id" IN (
          SELECT c."id" FROM "Monitor" c
          WHERE c."enabled" = true AND c."status" <> 'PAUSED'
            AND c."nextCheckAt" <= now()
          ORDER BY c."nextCheckAt"
          FOR UPDATE SKIP LOCKED
          LIMIT ${BATCH}
        )
        RETURNING m."id", m."nextCheckAt" AS next_check_at, m."intervalSeconds" AS interval_seconds
      `;

      if (claimed.length > 0) {
        await this.checksQueue.addBulk(
          claimed.map((row) => ({
            name: 'check',
            data: { monitorId: row.id },
          })),
        );
      }
    } catch (err) {
      logger.error({ err }, 'dispatcher tick failed');
    } finally {
      this.running = false;
    }
  }
}
