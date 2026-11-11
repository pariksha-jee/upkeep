import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

// NOTE: bullmq v6 reserves ':' in queue names (Redis key separator).
export const CHECKS_QUEUE = 'upkeep-checks';
export const NOTIFICATIONS_QUEUE = 'upkeep-notifications';
export const MAINTENANCE_QUEUE = 'upkeep-maintenance';

/** BullMQ requires maxRetriesPerRequest: null on its connections. */
export function bullRedis(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
}

export function createChecksQueue(): Queue {
  return new Queue(CHECKS_QUEUE, {
    connection: bullRedis(),
    defaultJobOptions: {
      removeOnComplete: 500,
      removeOnFail: 1000,
      attempts: 1,
    },
  });
}

export function createNotificationsQueue(): Queue {
  return new Queue(NOTIFICATIONS_QUEUE, {
    connection: bullRedis(),
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: 2000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  });
}

export interface ChecksJobData {
  monitorId: string;
}

export interface NotificationJobData {
  monitorId: string;
  userId: string;
  incidentId: string | null;
  /** null → push to all registered devices of the user */
  channelId: string | null;
  event: 'DOWN' | 'RECOVERY' | 'TEST';
}

/** Minimal queue surface used by injectors (avoids a @nestjs/bullmq dep). */
export interface QueueLike<T> {
  add(name: string, data: T, opts?: { jobId?: string }): Promise<unknown>;
  addBulk(jobs: Array<{ name: string; data: T }>): Promise<unknown>;
}

export const CHECKS_QUEUE_TOKEN = 'UPKEEP_CHECKS_QUEUE';
export const NOTIFICATIONS_QUEUE_TOKEN = 'UPKEEP_NOTIFICATIONS_QUEUE';
