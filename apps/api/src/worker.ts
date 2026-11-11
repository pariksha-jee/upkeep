import 'reflect-metadata';
process.env.UPKEEP_ROLE = 'worker';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module.js';
import { logger } from './shared/logger.js';
import { env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
  });
  app.enableShutdownHooks();

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'worker shutting down gracefully');
    void app.close().finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info(
    { concurrency: env.WORKER_CONCURRENCY, retentionDays: env.CHECK_RETENTION_DAYS },
    'Upkeep worker started',
  );
}

void bootstrap().catch((err: unknown) => {
  logger.fatal({ err }, 'worker failed to boot');
  process.exit(1);
});
