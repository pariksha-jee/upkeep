import { z, type ZodType } from 'zod';
import type { PaginationMeta } from '@upkeep/core';
import {
  authTokensDtoSchema,
  bindingDtoSchema,
  channelDtoSchema,
  checkDtoSchema,
  deviceDtoSchema,
  incidentDtoSchema,
  monitorDetailDtoSchema,
  monitorDtoSchema,
  monitorStatsDtoSchema,
  summaryDtoSchema,
  tunnelDtoSchema,
  userDtoSchema,
  type AuthTokensDto,
  type BindingDto,
  type BindingsUpdateInput,
  type ChannelDto,
  type CheckDto,
  type CreateChannelInput,
  type CreateMonitorInput,
  type CreateTunnelInput,
  type DeviceDto,
  type IncidentDto,
  type ListChecksQuery,
  type ListMonitorsQuery,
  type MonitorDetailDto,
  type MonitorDto,
  type MonitorStatsDto,
  type RegisterDeviceInput,
  type RegisterInput,
  type StatsWindow,
  type SummaryDto,
  type TunnelDto,
  type UpdateChannelInput,
  type UpdateMonitorInput,
  type UpdateProfileInput,
  type UpdateTunnelInput,
  type UserDto,
} from '@upkeep/core';
import { ApiError } from './errors.js';

export interface UpkeepClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** Bearer mode (mobile): pull the current access token. */
  getAccessToken?: () => string | null | undefined;
  /** Bearer mode (mobile): pull the refresh token for rotation. */
  getRefreshToken?: () => string | null | undefined;
  /** Bearer mode (mobile): store rotated tokens. */
  onTokens?: (tokens: AuthTokensDto) => void;
  /** Cookie mode (web): send credentials + CSRF header on mutations. */
  useCookies?: boolean;
}

interface Query {
  [key: string]: string | number | boolean | undefined | null;
}

interface RequestOpts<T> {
  body?: unknown;
  query?: Query;
  schema: ZodType<T>;
  method?: string;
}

const zDeleted = z.object({ deleted: z.literal(true) });
const zLoggedOut = z.object({ loggedOut: z.literal(true) });
const zVerify = z.object({ delivered: z.boolean(), error: z.string().nullable() });
const zTunnelTest = z.object({
  ok: z.boolean(),
  message: z.string(),
  credentialExpiresAt: z.string().nullable(),
});
const zTestNow = z.object({
  outcome: z.object({
    ok: z.boolean(),
    responseTimeMs: z.number().nullable(),
    statusCode: z.number().nullable(),
    error: z.string().nullable(),
  }),
  status: z.enum(['PENDING', 'UP', 'DOWN', 'PAUSED']),
  transition: z.enum(['none', 'went-down', 'went-up']),
});

/**
 * Typed HTTP client for the Upkeep API. Unwraps the response envelope, parses
 * payloads with the shared Zod schemas, maps errors to ApiError and performs a
 * single automatic token refresh + retry on 401 (bearer or cookie session).
 */
export class UpkeepClient {
  private readonly cfg: UpkeepClientConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: UpkeepClientConfig) {
    this.cfg = cfg;
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  // ─── plumbing ─────────────────────────────────────────────────────────────

  private baseUrl(path: string, query?: Query): string {
    const url = new URL(`${this.cfg.baseUrl.replace(/\/$/, '')}${path}`);
    if (query !== undefined) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.cfg.useCookies === true) headers['x-upkeep-csrf'] = '1';
      const refreshToken = this.cfg.getRefreshToken?.();
      const res = await this.fetchImpl(this.baseUrl('/v1/auth/refresh'), {
        method: 'POST',
        headers,
        credentials: 'include',
        ...(refreshToken !== null && refreshToken !== undefined
          ? { body: JSON.stringify({ refreshToken }) }
          : {}),
      });
      if (!res.ok) return false;
      const envelope = (await res.json()) as { data: unknown };
      const tokens = authTokensDtoSchema.parse(envelope.data);
      this.cfg.onTokens?.(tokens);
      return true;
    } catch {
      return false;
    }
  }

  private async rawRequest(
    method: string,
    path: string,
    body: unknown,
    query: Query | undefined,
    isRetry: boolean,
  ): Promise<{ status: number; json: unknown }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = this.cfg.getAccessToken?.();
    if (this.cfg.getAccessToken !== undefined && token != null) {
      headers.authorization = `Bearer ${token}`;
    }
    if (this.cfg.useCookies === true && method !== 'GET') {
      headers['x-upkeep-csrf'] = '1';
    }

    const res = await this.fetchImpl(this.baseUrl(path, query), {
      method,
      headers,
      credentials: this.cfg.useCookies === true ? 'include' : 'same-origin',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const canRefresh = this.cfg.getRefreshToken !== undefined || this.cfg.useCookies === true;
    if (res.status === 401 && !isRetry && canRefresh) {
      if (await this.tryRefresh()) {
        return this.rawRequest(method, path, body, query, true);
      }
    }

    const json: unknown = await res.json().catch(() => ({
      success: false,
      error: { code: 'BAD_JSON', message: 'empty response body' },
    }));
    return { status: res.status, json };
  }

  private errorFrom(status: number, json: unknown): ApiError {
    const err = (
      json as {
        error?: {
          code?: string;
          message?: string;
          requestId?: string;
          details?: Array<{ path: string; message: string }>;
        };
      }
    ).error;
    return new ApiError(
      status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `request failed (${status})`,
      err?.requestId ?? null,
      err?.details ?? null,
    );
  }

  private async request<T>(path: string, opts: RequestOpts<T>): Promise<T> {
    const { status, json } = await this.rawRequest(
      opts.method ?? 'GET',
      path,
      opts.body,
      opts.query,
      false,
    );
    if (status >= 400) throw this.errorFrom(status, json);
    const envelope = json as { success?: boolean; data?: unknown };
    if (envelope.success !== true) {
      throw new ApiError(status, 'BAD_ENVELOPE', 'unexpected response shape');
    }
    return opts.schema.parse(envelope.data);
  }

  private async requestWithMeta<T>(
    path: string,
    opts: RequestOpts<T>,
  ): Promise<{ data: T; meta?: PaginationMeta }> {
    const { status, json } = await this.rawRequest(
      opts.method ?? 'GET',
      path,
      opts.body,
      opts.query,
      false,
    );
    if (status >= 400) throw this.errorFrom(status, json);
    const envelope = json as { success: boolean; data: unknown; meta?: PaginationMeta };
    return { data: opts.schema.parse(envelope.data), meta: envelope.meta };
  }

  // ─── auth ─────────────────────────────────────────────────────────────────

  register(input: RegisterInput): Promise<AuthTokensDto> {
    return this.request('/v1/auth/register', {
      method: 'POST',
      body: input,
      schema: authTokensDtoSchema,
    });
  }

  login(email: string, password: string): Promise<AuthTokensDto> {
    return this.request('/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      schema: authTokensDtoSchema,
    });
  }

  logout(): Promise<{ loggedOut: true }> {
    return this.request('/v1/auth/logout', { method: 'POST', schema: zLoggedOut });
  }

  me(): Promise<UserDto> {
    return this.request('/v1/auth/me', { schema: userDtoSchema });
  }

  updateProfile(input: UpdateProfileInput): Promise<UserDto> {
    return this.request('/v1/users/me', {
      method: 'PATCH',
      body: input,
      schema: userDtoSchema,
    });
  }

  // ─── monitors ─────────────────────────────────────────────────────────────

  listMonitors(
    query?: Partial<ListMonitorsQuery>,
  ): Promise<{ data: MonitorDto[]; meta?: PaginationMeta }> {
    return this.requestWithMeta('/v1/monitors', {
      query: (query ?? {}) as Query,
      schema: z.array(monitorDtoSchema),
    });
  }

  createMonitor(input: CreateMonitorInput): Promise<MonitorDetailDto> {
    return this.request('/v1/monitors', {
      method: 'POST',
      body: input,
      schema: monitorDetailDtoSchema,
    });
  }

  getMonitor(id: string): Promise<MonitorDetailDto> {
    return this.request(`/v1/monitors/${id}`, { schema: monitorDetailDtoSchema });
  }

  updateMonitor(id: string, input: UpdateMonitorInput): Promise<MonitorDetailDto> {
    return this.request(`/v1/monitors/${id}`, {
      method: 'PATCH',
      body: input,
      schema: monitorDetailDtoSchema,
    });
  }

  deleteMonitor(id: string): Promise<{ deleted: true }> {
    return this.request(`/v1/monitors/${id}`, { method: 'DELETE', schema: zDeleted });
  }

  pauseMonitor(id: string): Promise<MonitorDetailDto> {
    return this.request(`/v1/monitors/${id}/pause`, {
      method: 'POST',
      schema: monitorDetailDtoSchema,
    });
  }

  resumeMonitor(id: string): Promise<MonitorDetailDto> {
    return this.request(`/v1/monitors/${id}/resume`, {
      method: 'POST',
      schema: monitorDetailDtoSchema,
    });
  }

  testMonitor(id: string): Promise<z.infer<typeof zTestNow>> {
    return this.request(`/v1/monitors/${id}/test`, { method: 'POST', schema: zTestNow });
  }

  listMonitorChecks(id: string, query?: Partial<ListChecksQuery>): Promise<CheckDto[]> {
    return this.request(`/v1/monitors/${id}/checks`, {
      query: (query ?? {}) as Query,
      schema: z.array(checkDtoSchema),
    });
  }

  monitorStats(id: string, window: StatsWindow): Promise<MonitorStatsDto> {
    return this.request(`/v1/monitors/${id}/stats`, {
      query: { window },
      schema: monitorStatsDtoSchema,
    });
  }

  updateMonitorBindings(id: string, input: BindingsUpdateInput): Promise<BindingDto[]> {
    return this.request(`/v1/monitors/${id}/bindings`, {
      method: 'PUT',
      body: input,
      schema: z.array(bindingDtoSchema),
    });
  }

  // ─── tunnels ──────────────────────────────────────────────────────────────

  listTunnels(): Promise<TunnelDto[]> {
    return this.request('/v1/tunnels', { schema: z.array(tunnelDtoSchema) });
  }

  createTunnel(input: CreateTunnelInput): Promise<TunnelDto> {
    return this.request('/v1/tunnels', { method: 'POST', body: input, schema: tunnelDtoSchema });
  }

  updateTunnel(id: string, input: UpdateTunnelInput): Promise<TunnelDto> {
    return this.request(`/v1/tunnels/${id}`, {
      method: 'PATCH',
      body: input,
      schema: tunnelDtoSchema,
    });
  }

  deleteTunnel(id: string): Promise<{ deleted: true }> {
    return this.request(`/v1/tunnels/${id}`, { method: 'DELETE', schema: zDeleted });
  }

  testTunnel(id: string): Promise<z.infer<typeof zTunnelTest>> {
    return this.request(`/v1/tunnels/${id}/test`, { method: 'POST', schema: zTunnelTest });
  }

  // ─── channels ─────────────────────────────────────────────────────────────

  listChannels(): Promise<ChannelDto[]> {
    return this.request('/v1/channels', { schema: z.array(channelDtoSchema) });
  }

  createChannel(input: CreateChannelInput): Promise<ChannelDto> {
    return this.request('/v1/channels', { method: 'POST', body: input, schema: channelDtoSchema });
  }

  updateChannel(id: string, input: UpdateChannelInput): Promise<ChannelDto> {
    return this.request(`/v1/channels/${id}`, {
      method: 'PATCH',
      body: input,
      schema: channelDtoSchema,
    });
  }

  deleteChannel(id: string): Promise<{ deleted: true }> {
    return this.request(`/v1/channels/${id}`, { method: 'DELETE', schema: zDeleted });
  }

  verifyChannel(id: string): Promise<z.infer<typeof zVerify>> {
    return this.request(`/v1/channels/${id}/verify`, { method: 'POST', schema: zVerify });
  }

  // ─── incidents ────────────────────────────────────────────────────────────

  listIncidents(query?: {
    status?: 'OPEN' | 'RESOLVED';
    monitorId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: IncidentDto[]; meta?: PaginationMeta }> {
    return this.requestWithMeta('/v1/incidents', {
      query: (query ?? {}) as Query,
      schema: z.array(incidentDtoSchema),
    });
  }

  // ─── devices ──────────────────────────────────────────────────────────────

  registerDevice(input: RegisterDeviceInput): Promise<DeviceDto> {
    return this.request('/v1/devices', { method: 'POST', body: input, schema: deviceDtoSchema });
  }

  deleteDevice(id: string): Promise<{ deleted: true }> {
    return this.request(`/v1/devices/${id}`, { method: 'DELETE', schema: zDeleted });
  }

  // ─── summary ──────────────────────────────────────────────────────────────

  summary(): Promise<SummaryDto> {
    return this.request('/v1/summary', { schema: summaryDtoSchema });
  }
}
