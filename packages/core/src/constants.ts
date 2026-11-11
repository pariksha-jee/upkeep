/**
 * Domain constants — single source of truth shared by API, web and mobile.
 * The Prisma enums in packages/db/prisma/schema.prisma mirror the string unions here.
 */

// ─── Check intervals offered to users (seconds) ──────────────────────────────
export const CHECK_INTERVALS = [30, 60, 300, 600, 900, 1800, 3600] as const;
export type CheckInterval = (typeof CHECK_INTERVALS)[number];

// ─── Statistics windows ───────────────────────────────────────────────────────
export const STATS_WINDOWS = {
  '1h': 3600,
  '24h': 86_400,
  '7d': 604_800,
  '30d': 2_592_000,
  '90d': 7_776_000,
} as const;
export type StatsWindow = keyof typeof STATS_WINDOWS;

// ─── Per-user limits (v1 defaults; tunable via env on the API side) ──────────
export const LIMITS = {
  monitorsPerUser: 50,
  tunnelsPerUser: 5,
  channelsPerUser: 10,
  monitorNameMax: 100,
  tunnelNameMax: 100,
  channelLabelMax: 100,
  keywordMax: 128,
  bodyMax: 8192,
  targetMax: 2048,
  headerCountMax: 20,
  headerNameMax: 128,
  headerValueMax: 2048,
  timeoutMsMin: 1000,
  timeoutMsMax: 30_000,
  thresholdMin: 1,
  thresholdMax: 10,
  cooldownMinMinutes: 0,
  cooldownMaxMinutes: 1440,
} as const;

// ─── Defaults applied on monitor/binding creation ────────────────────────────
export const DEFAULTS = {
  timeoutMs: 10_000,
  failureThreshold: 2,
  recoveryThreshold: 2,
  cooldownMinutes: 5,
  sshPort: 22,
} as const;

// ─── Domain string unions (Prisma enums must stay in sync) ───────────────────
export const MONITOR_TYPES = ['HTTP', 'TCP'] as const;
export type MonitorType = (typeof MONITOR_TYPES)[number];

export const MONITOR_STATUSES = ['PENDING', 'UP', 'DOWN', 'PAUSED'] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export const CHECK_STATUSES = ['UP', 'DOWN'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const TUNNEL_TYPES = ['SSH', 'OPENVPN'] as const;
export type TunnelType = (typeof TUNNEL_TYPES)[number];

export const TUNNEL_STATUSES = [
  'UNKNOWN',
  'CONNECTING',
  'CONNECTED',
  'DEGRADED',
  'EXPIRED',
  'FAILED',
] as const;
export type TunnelStatus = (typeof TUNNEL_STATUSES)[number];

export const CREDENTIAL_SOURCES = ['INLINE', 'SIGNED_URL'] as const;
export type CredentialSource = (typeof CREDENTIAL_SOURCES)[number];

export const CREDENTIAL_PROVIDERS = ['AWS_S3', 'GCP_CS'] as const;
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];

export const CHANNEL_TYPES = ['EMAIL', 'SMS', 'WEBHOOK'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const INCIDENT_STATUSES = ['OPEN', 'RESOLVED'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const NOTIFICATION_STATUSES = ['SENT', 'FAILED', 'SKIPPED'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const DEVICE_PLATFORMS = ['ANDROID', 'IOS'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const NOTIFY_EVENTS = ['DOWN', 'RECOVERY', 'TEST', 'SYSTEM'] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

// ─── Wire-level misc ─────────────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
