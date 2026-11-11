/**
 * Plain (non-inferred) shared types. DTO types with runtime validation live in
 * schemas/response.ts and are inferred from Zod schemas there.
 */

/** Standard pagination envelope field returned by list endpoints. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/** Error payload returned by every failing endpoint (guardrails §6.3). */
export interface ApiErrorShape {
  code: string;
  message: string;
  requestId: string;
  details?: Array<{ path: string; message: string }>;
}

/** Sanitized channel configuration returned over the wire (secrets never included). */
export type ChannelConfig =
  { kind: 'EMAIL'; to: string } | { kind: 'SMS'; to: string } | { kind: 'WEBHOOK'; url: string };

/** Outbound webhook payload (v1 contract, `version` field for forward compat). */
export interface WebhookPayload {
  version: 1;
  event: NotifyEvent;
  monitor: {
    id: string;
    name: string;
    type: MonitorType;
    target: string;
  };
  incident: {
    id: string;
    startedAt: string;
    resolvedAt: string | null;
    cause: string | null;
  } | null;
  message: string;
  occurredAt: string;
}

// Re-use domain unions for convenience in one import site.
export type {
  ChannelType,
  CheckStatus,
  CredentialProvider,
  CredentialSource,
  DevicePlatform,
  IncidentStatus,
  MonitorStatus,
  MonitorType,
  NotifyEvent,
  NotificationStatus,
  TunnelStatus,
  TunnelType,
  UserRole,
} from './constants.js';
