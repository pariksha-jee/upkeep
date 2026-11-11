import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import { PrismaService } from '../shared/prisma.service.js';
import { logger } from '../shared/logger.js';
import { env } from '../config/env.js';
import { CheckExecutor } from '../worker-core/check-executor.js';
import { NotificationDispatcher } from '../worker-core/notify/notification-dispatcher.js';
import {
  CHECKS_QUEUE,
  NOTIFICATIONS_QUEUE,
  bullRedis,
  type ChecksJobData,
  type NotificationJobData,
} from '../worker-core/queues.js';

/** BullMQ workers: checks executor + notification dispatcher. */
@Injectable()
export class QueueProcessors implements OnApplicationBootstrap, OnModuleDestroy {
  private workers: Worker[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: CheckExecutor,
    private readonly notifications: NotificationDispatcher,
  ) {}

  onApplicationBootstrap(): void {
    const connection = bullRedis();

    const checksWorker = new Worker<ChecksJobData>(
      CHECKS_QUEUE,
      async (job) => {
        await this.executor.executeMonitor(job.data.monitorId, { trigger: 'scheduled' });
      },
      { connection, concurrency: env.WORKER_CONCURRENCY },
    );
    checksWorker.on('failed', (job, err) => {
      logger.warn(
        { jobId: job?.id, monitorId: job?.data.monitorId, err: err.message },
        'check job failed',
      );
    });

    const notificationsWorker = new Worker<NotificationJobData>(
      NOTIFICATIONS_QUEUE,
      async (job) => {
        const { monitorId, userId, incidentId, channelId, event } = job.data;
        const monitor = await this.prisma.monitor.findUnique({
          where: { id: monitorId },
          select: { id: true, name: true, type: true, target: true },
        });
        if (monitor === null) return;
        if (channelId === null) {
          // Device push fan-out.
          await this.notifications.dispatchDevices(userId, monitor, event, incidentId);
          return;
        }
        const binding = await this.prisma.alertBinding.findFirst({
          where: { monitorId, channelId },
        });
        if (binding === null) return;
        await this.notifications.dispatchBinding(
          binding.id,
          monitor,
          event === 'TEST' ? 'TEST' : event,
          incidentId,
        );
      },
      { connection, concurrency: 25 },
    );
    notificationsWorker.on('failed', (job, err) => {
      logger.warn({ jobId: job?.id, err: err.message }, 'notification job failed');
    });

    this.workers.push(checksWorker, notificationsWorker);
    logger.info(
      { concurrency: env.WORKER_CONCURRENCY, queues: [CHECKS_QUEUE, NOTIFICATIONS_QUEUE] },
      'queue workers started',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
