import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, Text, View } from 'react-native';
import { api, useAuth } from '@/lib/auth';
import { StatusChip } from '@/components/StatusChip';
import { useTheme } from '@/components/ThemeProvider';
import { formatInterval, formatMs, formatPercent, relativeTime } from '@/lib/format';

export default function MonitorDetailScreen(): React.ReactElement | null {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuth((s) => s.accessToken);

  const { data: monitor } = useQuery({
    queryKey: ['mobile-monitor', id],
    queryFn: () => api.getMonitor(id),
    enabled: typeof id === 'string' && accessToken !== null,
    refetchInterval: 15_000,
  });
  const { data: stats } = useQuery({
    queryKey: ['mobile-stats', id],
    queryFn: () => api.monitorStats(id, '24h'),
    enabled: typeof id === 'string' && accessToken !== null,
    refetchInterval: 30_000,
  });
  const { data: checks } = useQuery({
    queryKey: ['mobile-checks', id],
    queryFn: () => api.listMonitorChecks(id, { limit: 20 }),
    enabled: typeof id === 'string' && accessToken !== null,
    refetchInterval: 15_000,
  });

  if (monitor === undefined || id === undefined) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.textMuted }}>Loading…</Text>
      </View>
    );
  }

  const card = {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, backgroundColor: theme.background }}>
      <View
        style={[
          card,
          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        ]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 18 }}>
            {monitor.name}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
            {monitor.type === 'TCP' ? `${monitor.target}:${monitor.port ?? ''}` : monitor.target}
          </Text>
        </View>
        <StatusChip status={monitor.status} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[card, { flex: 1 }]}>
          <Text style={{ color: theme.textMuted, fontSize: 11, textTransform: 'uppercase' }}>
            24h uptime
          </Text>
          <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '700' }}>
            {stats !== undefined ? formatPercent(stats.uptimeRatio) : '—'}
          </Text>
        </View>
        <View style={[card, { flex: 1 }]}>
          <Text style={{ color: theme.textMuted, fontSize: 11, textTransform: 'uppercase' }}>
            Avg response
          </Text>
          <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '700' }}>
            {stats !== undefined ? formatMs(stats.avgResponseMs) : '—'}
          </Text>
        </View>
        <View style={[card, { flex: 1 }]}>
          <Text style={{ color: theme.textMuted, fontSize: 11, textTransform: 'uppercase' }}>
            Last check
          </Text>
          <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>
            {relativeTime(monitor.lastCheckedAt)}
          </Text>
        </View>
      </View>

      <View style={card}>
        <Text
          style={{
            color: theme.textMuted,
            fontSize: 11,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Configuration
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          every {formatInterval(monitor.intervalSeconds)} · timeout {monitor.timeoutMs} ms · down
          after {monitor.failureThreshold} · up after {monitor.recoveryThreshold}
          {monitor.tunnelId !== null ? ' · through tunnel' : ''}
        </Text>
        {monitor.bindings.length > 0 ? (
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
            Alerts: {monitor.bindings.map((b) => b.channelLabel).join(', ')}
          </Text>
        ) : null}
      </View>

      <View style={card}>
        <Text
          style={{
            color: theme.textMuted,
            fontSize: 11,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Recent checks
        </Text>
        {(checks ?? []).slice(0, 15).map((c) => (
          <View
            key={c.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 6,
              gap: 8,
            }}
          >
            <Text style={{ color: theme.textSecondary, fontSize: 12, flex: 1 }}>
              {relativeTime(c.checkedAt)}
            </Text>
            <Text
              style={{
                color: c.status === 'UP' ? theme.statusUp : theme.statusDown,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {c.status === 'UP' ? 'OK' : 'FAIL'}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, width: 64, textAlign: 'right' }}>
              {formatMs(c.responseTimeMs)}
            </Text>
          </View>
        ))}
        {(checks ?? []).length === 0 ? (
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>No checks yet.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
