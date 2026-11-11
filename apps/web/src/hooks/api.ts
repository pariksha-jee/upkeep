'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  ChannelDto,
  CheckDto,
  CreateChannelInput,
  CreateMonitorInput,
  CreateTunnelInput,
  MonitorDetailDto,
  MonitorStatsDto,
  StatsWindow,
  SummaryDto,
  TunnelDto,
  UpdateChannelInput,
  UpdateMonitorInput,
  UpdateTunnelInput,
  UserDto,
} from '@upkeep/core';
import { api } from '@/lib/api';
import { useSessionStore } from '@/stores/session';

// ─── Session ─────────────────────────────────────────────────────────────

export function useSession(): UseQueryResult<UserDto | null> {
  const setSession = useSessionStore((s) => s.setSession);
  const setHydrated = useSessionStore((s) => s.setHydrated);
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const me = await api.me();
        setSession(me);
        return me;
      } catch {
        setSession(null);
        return null;
      } finally {
        setHydrated(true);
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

// ─── Monitors ────────────────────────────────────────────────────────────

export function useMonitors(page = 1, filters?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: ['monitors', page, filters ?? {}],
    queryFn: () =>
      api.listMonitors({
        page,
        limit: 25,
        ...(filters?.status !== undefined && filters.status !== ''
          ? { status: filters.status as MonitorStatus }
          : {}),
        ...(filters?.type !== undefined && filters.type !== ''
          ? { type: filters.type as MonitorType }
          : {}),
      }),
    refetchInterval: 15_000,
  });
}

type MonitorStatus = 'PENDING' | 'UP' | 'DOWN' | 'PAUSED';
type MonitorType = 'HTTP' | 'TCP';

export function useMonitor(id: string) {
  return useQuery({
    queryKey: ['monitor', id],
    queryFn: (): Promise<MonitorDetailDto> => api.getMonitor(id),
    refetchInterval: 15_000,
  });
}

export function useMonitorChecks(id: string, limit = 50) {
  return useQuery({
    queryKey: ['monitor-checks', id, limit],
    queryFn: (): Promise<CheckDto[]> => api.listMonitorChecks(id, { limit }),
    refetchInterval: 15_000,
  });
}

export function useMonitorStats(id: string, window: StatsWindow) {
  return useQuery({
    queryKey: ['monitor-stats', id, window],
    queryFn: (): Promise<MonitorStatsDto> => api.monitorStats(id, window),
    refetchInterval: 30_000,
  });
}

export function useMonitorMutations() {
  const qc = useQueryClient();
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['monitors'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: CreateMonitorInput) => api.createMonitor(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateMonitorInput }) =>
        api.updateMonitor(id, input),
      onSuccess: (_d, v) => {
        invalidate();
        void qc.invalidateQueries({ queryKey: ['monitor', v.id] });
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteMonitor(id),
      onSuccess: invalidate,
    }),
    pause: useMutation({
      mutationFn: (id: string) => api.pauseMonitor(id),
      onSuccess: (_d, id) => {
        invalidate();
        void qc.invalidateQueries({ queryKey: ['monitor', id] });
      },
    }),
    resume: useMutation({
      mutationFn: (id: string) => api.resumeMonitor(id),
      onSuccess: (_d, id) => {
        invalidate();
        void qc.invalidateQueries({ queryKey: ['monitor', id] });
      },
    }),
    testNow: useMutation({
      mutationFn: (id: string) => api.testMonitor(id),
      onSuccess: (_d, id) => {
        void qc.invalidateQueries({ queryKey: ['monitor', id] });
        void qc.invalidateQueries({ queryKey: ['monitor-checks', id] });
        void qc.invalidateQueries({ queryKey: ['monitors'] });
      },
    }),
    setBindings: useMutation({
      mutationFn: ({ id, channelIds }: { id: string; channelIds: string[] }) =>
        api.updateMonitorBindings(
          id,
          channelIds.map((channelId) => ({
            channelId,
            notifyOnDown: true,
            notifyOnRecovery: true,
            cooldownMinutes: 5,
          })),
        ),
      onSuccess: (_d, v) => {
        void qc.invalidateQueries({ queryKey: ['monitor', v.id] });
      },
    }),
  };
}

// ─── Tunnels ──────────────────────────────────────────────────────────────

export function useTunnels() {
  return useQuery({
    queryKey: ['tunnels'],
    queryFn: (): Promise<TunnelDto[]> => api.listTunnels(),
    refetchInterval: 30_000,
  });
}

export function useTunnelMutations() {
  const qc = useQueryClient();
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['tunnels'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: CreateTunnelInput) => api.createTunnel(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateTunnelInput }) =>
        api.updateTunnel(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteTunnel(id),
      onSuccess: invalidate,
    }),
    test: useMutation({ mutationFn: (id: string) => api.testTunnel(id), onSuccess: invalidate }),
  };
}

// ─── Channels ────────────────────────────────────────────────────────────

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: (): Promise<ChannelDto[]> => api.listChannels(),
  });
}

export function useChannelMutations() {
  const qc = useQueryClient();
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ['channels'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: CreateChannelInput) => api.createChannel(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateChannelInput }) =>
        api.updateChannel(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteChannel(id),
      onSuccess: invalidate,
    }),
    verify: useMutation({
      mutationFn: (id: string) => api.verifyChannel(id),
      onSuccess: invalidate,
    }),
  };
}

// ─── Incidents / summary ─────────────────────────────────────────────────

export function useIncidents(status?: 'OPEN' | 'RESOLVED', page = 1) {
  return useQuery({
    queryKey: ['incidents', status ?? 'all', page],
    queryFn: () =>
      api.listIncidents({ ...(status !== undefined ? { status } : {}), page, limit: 25 }),
    refetchInterval: 20_000,
  });
}

export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: (): Promise<SummaryDto> => api.summary(),
    refetchInterval: 15_000,
  });
}
