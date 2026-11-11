import { Global, Module, type Provider } from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../shared/logger.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Shared Redis connection for readiness probes, tunnel leases and misc state.
 * BullMQ manages its own connections from REDIS_URL. Connection errors are
 * handled (logged) so an outage degrades readiness instead of crashing boot.
 */
const client = new Redis(env.REDIS_URL, {
  lazyConnect: false,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => Math.min(times * 500, 10_000),
});
client.on('error', (err: Error) => {
  logger.warn({ err: err.message }, 'redis connection error (readiness degraded)');
});
client.on('ready', () => {
  logger.info('redis connected');
});

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useValue: client,
};

@Global()
@Module({
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
