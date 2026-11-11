import { z } from 'zod';
import {
  CHECK_INTERVALS,
  DEFAULTS,
  HTTP_METHODS,
  LIMITS,
  MONITOR_STATUSES,
  MONITOR_TYPES,
  STATS_WINDOWS,
} from '../constants.js';
import { paginationQuerySchema, uuidSchema } from './common.js';

const commonMonitorFields = {
  name: z.string().min(1).max(LIMITS.monitorNameMax),
  // zod 4's z.enum does not accept readonly number tuples — use a literal union.
  intervalSeconds: z.union(CHECK_INTERVALS.map((s) => z.literal(s))),
  timeoutMs: z
    .number()
    .int()
    .min(LIMITS.timeoutMsMin)
    .max(LIMITS.timeoutMsMax)
    .default(DEFAULTS.timeoutMs),
  failureThreshold: z
    .number()
    .int()
    .min(LIMITS.thresholdMin)
    .max(LIMITS.thresholdMax)
    .default(DEFAULTS.failureThreshold),
  recoveryThreshold: z
    .number()
    .int()
    .min(LIMITS.thresholdMin)
    .max(LIMITS.thresholdMax)
    .default(DEFAULTS.recoveryThreshold),
  /** Attach the monitor to a tunnel to reach private endpoints. */
  tunnelId: uuidSchema.nullish(),
  /** Create alert bindings inline on monitor creation. */
  channelIds: z.array(uuidSchema).max(LIMITS.channelsPerUser).default([]),
};

export const createHttpMonitorSchema = z.object({
  type: z.literal('HTTP'),
  target: z.url().refine((v) => v.startsWith('http://') || v.startsWith('https://'), {
    message: 'target must be an http(s) URL',
  }),
  method: z.enum(HTTP_METHODS).default('GET'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().max(LIMITS.bodyMax).optional(),
  keyword: z.string().min(1).max(LIMITS.keywordMax).optional(),
  expectedStatusCodes: z.array(z.number().int().min(100).max(599)).max(10).optional(),
  ...commonMonitorFields,
});

export const createTcpMonitorSchema = z.object({
  type: z.literal('TCP'),
  /** Hostname or IP — resolved on the far side of the tunnel when attached. */
  target: z
    .string()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9._-]+$/, { message: 'target must be a hostname or IP' }),
  port: z.number().int().min(1).max(65535),
  ...commonMonitorFields,
});

export const createMonitorSchema = z.discriminatedUnion('type', [
  createHttpMonitorSchema,
  createTcpMonitorSchema,
]);
export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;

/** Monitor type is immutable; everything else is patchable. */
export const updateMonitorSchema = z.object({
  name: z.string().min(1).max(LIMITS.monitorNameMax).optional(),
  intervalSeconds: z.union(CHECK_INTERVALS.map((s) => z.literal(s))).optional(),
  timeoutMs: z.number().int().min(LIMITS.timeoutMsMin).max(LIMITS.timeoutMsMax).optional(),
  failureThreshold: z.number().int().min(LIMITS.thresholdMin).max(LIMITS.thresholdMax).optional(),
  recoveryThreshold: z.number().int().min(LIMITS.thresholdMin).max(LIMITS.thresholdMax).optional(),
  enabled: z.boolean().optional(),
  tunnelId: uuidSchema.nullable().optional(),
  // HTTP-only fields (ignored for TCP monitors)
  method: z.enum(HTTP_METHODS).optional(),
  headers: z.record(z.string(), z.string()).nullish(),
  body: z.string().max(LIMITS.bodyMax).nullish(),
  keyword: z.string().min(1).max(LIMITS.keywordMax).nullish(),
  expectedStatusCodes: z.array(z.number().int().min(100).max(599)).max(10).nullish(),
  channelIds: z.array(uuidSchema).max(LIMITS.channelsPerUser).optional(),
});
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;

export const listMonitorsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(MONITOR_STATUSES).optional(),
  type: z.enum(MONITOR_TYPES).optional(),
});
export type ListMonitorsQuery = z.infer<typeof listMonitorsQuerySchema>;

export const listChecksQuerySchema = z.object({
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
export type ListChecksQuery = z.infer<typeof listChecksQuerySchema>;

export const statsQuerySchema = z.object({
  window: z.enum(['1h', '24h', '7d', '30d', '90d']),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export type StatsWindowKey = keyof typeof STATS_WINDOWS;
