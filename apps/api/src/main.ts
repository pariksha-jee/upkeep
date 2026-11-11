import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { env, isProduction } from './config/env.js';
import { logger } from './shared/logger.js';
import { requestIdMiddleware } from './common/request-id.middleware.js';
import { csrfMiddleware } from './common/csrf.middleware.js';
import { openApiDocument } from './openapi.js';
import type { Request, Response, NextFunction } from './compat/express.js';

/** Minimal structured request logging (Pino, no console). */
function requestLogging(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      'request',
    );
  });
  next();
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const http = app.getHttpAdapter().getInstance();
  http.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Upkeep-Csrf', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(requestLogging);
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.use(csrfMiddleware);

  // Raw spec (outside the envelope, outside the version prefix).
  app.getHttpAdapter().get('/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('content-type', 'application/json');
    res.json(openApiDocument);
  });

  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready', 'openapi.json'] });
  app.enableShutdownHooks();

  await app.listen(env.PORT, env.HOST);
  logger.info(
    { host: env.HOST, port: env.PORT, env: env.NODE_ENV, production: isProduction },
    'Upkeep API listening',
  );
}

void bootstrap().catch((err: unknown) => {
  // stderr.write is synchronous — pino's async flush can race process.exit.
  process.stderr.write(
    `FATAL: API failed to boot\n${err instanceof Error ? err.stack : String(err)}\n`,
  );
  logger.fatal({ err }, 'API failed to boot');
  process.exit(1);
});
