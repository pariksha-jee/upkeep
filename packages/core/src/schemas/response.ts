/**
 * Response DTO schemas — the wire contract. The API maps its Prisma rows to
 * these shapes; web/mobile parse responses with them via @upkeep/api-client.
 */
import { z } from 'zod';
import {
  CHANNEL_TYPES,
  CHECK_STATUSES,
  CREDENTIAL_PROVIDERS,
  CREDENTIAL_SOURCES,
  DEVICE_PLATFORMS,
  INCIDENT_STATUSES,
  MONITOR_STATUSES,
  MONITOR_TYPES,
  NOTIFICATION_STATUSES,
  NOTIFY_EVENTS,
  TUNNEL_STATUSES,
  TUNNEL_TYPES,
  USER_ROLES,
} from '../constants.js';

const iso = z.string();
const isoNullable = iso.nullable();

// ─── Auth / user ──────────────────────────────────────────────────────────────
export const userDtoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(USER_ROLES),
  createdAt: iso,
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const authTokensDtoSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userDtoSchema,
});
export type AuthTokensDto = z.infer<typeof authTokensDtoSchema>;

// ─── Monitors ─────────────────────────────────────────────────────────────────
export const monitorDtoSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  tunnelId: isoNullable,
  name: z.string(),
  type: z.enum(MONITOR_TYPES),
  target: z.string(),
  port: z.number().int().nullable(),
  method: isoNullable,
  headers: z.record(z.string(), z.string()).nullable(),
  body: isoNullable,
  keyword: isoNullable,
  expectedStatusCodes: z.array(z.number().int()).nullable(),
  intervalSeconds: z.number().int(),
  timeoutMs: z.number().int(),
  failureThreshold: z.number().int(),
  recoveryThreshold: z.number().int(),
  enabled: z.boolean(),
  status: z.enum(MONITOR_STATUSES),
  consecutiveFailures: z.number().int(),
  consecutiveSuccesses: z.number().int(),
  lastCheckedAt: isoNullable,
  nextCheckAt: isoNullable,
  createdAt: iso,
  updatedAt: iso,
  /** 24h uptime ratio, 0..1 — only present in list/summary payloads. */
  uptime24h: z.number().min(0).max(1).nullable().optional(),
});
export type MonitorDto = z.infer<typeof monitorDtoSchema>;

export const bindingDtoSchema = z.object({
  id: z.uuid(),
  monitorId: z.uuid(),
  channelId: z.uuid(),
  channelLabel: z.string(),
  channelType: z.enum(CHANNEL_TYPES),
  notifyOnDown: z.boolean(),
  notifyOnRecovery: z.boolean(),
  cooldownMinutes: z.number().int(),
  lastNotifiedAt: isoNullable,
});
export type BindingDto = z.infer<typeof bindingDtoSchema>;

export const monitorDetailDtoSchema = monitorDtoSchema.extend({
  bindings: z.array(bindingDtoSchema),
});
export type MonitorDetailDto = z.infer<typeof monitorDetailDtoSchema>;

// ─── Checks / stats ───────────────────────────────────────────────────────────
export const checkDtoSchema = z.object({
  id: z.string(), // BigInt serialized as string
  monitorId: z.uuid(),
  status: z.enum(CHECK_STATUSES),
  responseTimeMs: z.number().int().nullable(),
  statusCode: z.number().int().nullable(),
  error: isoNullable,
  checkedAt: iso,
});
export type CheckDto = z.infer<typeof checkDtoSchema>;

export const statsBucketDtoSchema = z.object({
  start: iso,
  total: z.number().int(),
  up: z.number().int(),
  avgMs: z.number().nullable(),
});
export type StatsBucketDto = z.infer<typeof statsBucketDtoSchema>;

export const monitorStatsDtoSchema = z.object({
  window: z.enum(['1h', '24h', '7d', '30d', '90d']),
  uptimeRatio: z.number().min(0).max(1),
  avgResponseMs: z.number().nullable(),
  minResponseMs: z.number().nullable(),
  maxResponseMs: z.number().nullable(),
  totalChecks: z.number().int(),
  failedChecks: z.number().int(),
  buckets: z.array(statsBucketDtoSchema),
});
export type MonitorStatsDto = z.infer<typeof monitorStatsDtoSchema>;

// ─── Tunnels ──────────────────────────────────────────────────────────────────
export const tunnelDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(TUNNEL_TYPES),
  credentialSource: z.enum(CREDENTIAL_SOURCES),
  credentialProvider: z.enum(CREDENTIAL_PROVIDERS).nullable(),
  credentialExpiresAt: isoNullable,
  fingerprint: z.string(),
  status: z.enum(TUNNEL_STATUSES),
  lastError: isoNullable,
  lastErrorAt: isoNullable,
  createdAt: iso,
});
export type TunnelDto = z.infer<typeof tunnelDtoSchema>;

// ─── Channels / notifications ─────────────────────────────────────────────────
export const channelDtoSchema = z.object({
  id: z.uuid(),
  type: z.enum(CHANNEL_TYPES),
  label: z.string(),
  config: z.union([
    z.object({ kind: z.literal('EMAIL'), to: z.email() }),
    z.object({ kind: z.literal('SMS'), to: z.string() }),
    z.object({ kind: z.literal('WEBHOOK'), url: z.string() }),
  ]),
  verifiedAt: isoNullable,
  createdAt: iso,
});
export type ChannelDto = z.infer<typeof channelDtoSchema>;

export const incidentDtoSchema = z.object({
  id: z.uuid(),
  monitorId: z.uuid(),
  monitorName: z.string(),
  status: z.enum(INCIDENT_STATUSES),
  startedAt: iso,
  resolvedAt: isoNullable,
  cause: isoNullable,
  lastError: isoNullable,
});
export type IncidentDto = z.infer<typeof incidentDtoSchema>;

export const notificationLogDtoSchema = z.object({
  id: z.uuid(),
  incidentId: isoNullable,
  channelId: z.uuid(),
  channelLabel: z.string(),
  type: z.enum(CHANNEL_TYPES),
  event: z.enum(NOTIFY_EVENTS),
  status: z.enum(NOTIFICATION_STATUSES),
  error: isoNullable,
  createdAt: iso,
});
export type NotificationLogDto = z.infer<typeof notificationLogDtoSchema>;

// ─── Devices ──────────────────────────────────────────────────────────────────
export const deviceDtoSchema = z.object({
  id: z.uuid(),
  platform: z.enum(DEVICE_PLATFORMS),
  appVersion: isoNullable,
  lastSeenAt: iso,
  createdAt: iso,
});
export type DeviceDto = z.infer<typeof deviceDtoSchema>;

// ─── Dashboard summary ────────────────────────────────────────────────────────
export const summaryDtoSchema = z.object({
  monitors: z.object({
    total: z.number().int(),
    up: z.number().int(),
    down: z.number().int(),
    paused: z.number().int(),
    pending: z.number().int(),
  }),
  openIncidents: z.number().int(),
  worstMonitors: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      uptime24h: z.number().min(0).max(1).nullable(),
    }),
  ),
  recentIncidents: z.array(incidentDtoSchema),
});
export type SummaryDto = z.infer<typeof summaryDtoSchema>;
