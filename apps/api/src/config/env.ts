import { z } from 'zod';

/**
 * Fail-fast environment boot guard (guardrails §7.1).
 * The process refuses to start when configuration is missing or insecure.
 */

// Node 20.6+: load .env natively when present (no dotenv dependency).
try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on real environment variables
}

const int = z.coerce.number().int();
const port = int.min(1).max(65535);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: port.default(4000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z
    .string()
    .base64()
    .refine((v) => Buffer.from(v, 'base64').byteLength === 32, {
      message: 'ENCRYPTION_KEY must be base64 for exactly 32 bytes (openssl rand -base64 32)',
    }),
  CORS_ORIGIN: z.string().min(1),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WORKER_CONCURRENCY: int.min(1).max(500).default(50),
  CHECK_RETENTION_DAYS: int.min(1).max(3650).default(45),
  CREDENTIAL_FETCH_MAX_BYTES: int.min(1024).max(10_485_760).default(262_144),
  CREDENTIAL_FETCH_TIMEOUT_MS: int.min(500).max(60_000).default(10_000),
  CREDENTIAL_HOST_ALLOWLIST: z.string().optional(),
  /** Self-hosted deployments may alert private webhook receivers. */
  WEBHOOK_ALLOW_PRIVATE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Optional providers — channels of the matching type are rejected when unset.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: port.default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Upkeep <no-reply@upkeep.dev>'),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),

  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  process.stderr.write('FATAL: invalid environment configuration\n');
  for (const issue of parsed.error.issues) {
    process.stderr.write(`  ${issue.path.join('.')}: ${issue.message}\n`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === 'production';

/** Feature flags derived from optional provider configuration. */
export const features = {
  email: env.SMTP_HOST !== undefined,
  sms:
    env.TWILIO_ACCOUNT_SID !== undefined &&
    env.TWILIO_AUTH_TOKEN !== undefined &&
    env.TWILIO_FROM !== undefined,
  push:
    env.FCM_PROJECT_ID !== undefined &&
    env.FCM_CLIENT_EMAIL !== undefined &&
    env.FCM_PRIVATE_KEY !== undefined,
} as const;
