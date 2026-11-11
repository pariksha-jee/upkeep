import type {
  BindingDto,
  MonitorDetailDto,
  MonitorDto,
  MonitorStatus,
  MonitorType,
} from '@upkeep/core';

type MonitorRow = {
  id: string;
  userId: string;
  tunnelId: string | null;
  name: string;
  type: MonitorType;
  target: string;
  port: number | null;
  method: string | null;
  headers: unknown;
  body: string | null;
  keyword: string | null;
  expectedStatusCodes: number[] | null;
  intervalSeconds: number;
  timeoutMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  enabled: boolean;
  status: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckedAt: Date | null;
  nextCheckAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BindingRow = {
  id: string;
  monitorId: string;
  channelId: string;
  notifyOnDown: boolean;
  notifyOnRecovery: boolean;
  cooldownMinutes: number;
  lastNotifiedAt: Date | null;
  channel: { label: string; type: 'EMAIL' | 'SMS' | 'WEBHOOK' };
};

export function toMonitorDto(row: MonitorRow, uptime24h?: number | null): MonitorDto {
  return {
    id: row.id,
    userId: row.userId,
    tunnelId: row.tunnelId,
    name: row.name,
    type: row.type,
    target: row.target,
    port: row.port,
    method: row.method,
    headers:
      row.headers !== null && row.headers !== undefined
        ? (row.headers as Record<string, string>)
        : null,
    body: row.body,
    keyword: row.keyword,
    expectedStatusCodes: row.expectedStatusCodes,
    intervalSeconds: row.intervalSeconds,
    timeoutMs: row.timeoutMs,
    failureThreshold: row.failureThreshold,
    recoveryThreshold: row.recoveryThreshold,
    enabled: row.enabled,
    status: row.status,
    consecutiveFailures: row.consecutiveFailures,
    consecutiveSuccesses: row.consecutiveSuccesses,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    nextCheckAt: row.nextCheckAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(uptime24h !== undefined ? { uptime24h } : {}),
  };
}

export function toBindingDto(row: BindingRow): BindingDto {
  return {
    id: row.id,
    monitorId: row.monitorId,
    channelId: row.channelId,
    channelLabel: row.channel.label,
    channelType: row.channel.type,
    notifyOnDown: row.notifyOnDown,
    notifyOnRecovery: row.notifyOnRecovery,
    cooldownMinutes: row.cooldownMinutes,
    lastNotifiedAt: row.lastNotifiedAt?.toISOString() ?? null,
  };
}

export function toMonitorDetailDto(row: MonitorRow & { bindings: BindingRow[] }): MonitorDetailDto {
  return { ...toMonitorDto(row), bindings: row.bindings.map(toBindingDto) };
}
