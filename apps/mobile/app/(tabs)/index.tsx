import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { api, useAuth } from '@/lib/auth';
import { StatusChip } from '@/components/StatusChip';
import { useTheme } from '@/components/ThemeProvider';
import { formatInterval, formatPercent, relativeTime } from '@/lib/format';

export default function MonitorsScreen(): React.ReactElement {
  const { theme } = useTheme();
  const accessToken = useAuth((s) => s.accessToken);
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mobile-monitors'],
    queryFn: () => api.listMonitors({ page: 1, limit: 50 }),
    enabled: accessToken !== null,
    refetchInterval: 20_000,
  });

  const monitors = data?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={monitors}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await refetch();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 40 }}>
              Loading monitors…
            </Text>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 40, gap: 8 }}>
              <Text style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 16 }}>
                No monitors yet
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                Watch a public URL, or a private service through a tunnel.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/monitor/${item.id}`)}
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              padding: 14,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 15, flex: 1 }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <StatusChip status={item.status} />
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
              {item.type === 'TCP' ? `${item.target}:${item.port ?? ''}` : item.target}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                every {formatInterval(item.intervalSeconds)} · {relativeTime(item.lastCheckedAt)}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                {item.uptime24h !== undefined && item.uptime24h !== null
                  ? formatPercent(item.uptime24h)
                  : '—'}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <Pressable
        onPress={() => router.push('/monitor/new')}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          backgroundColor: theme.primary,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          elevation: 6,
        }}
        accessibilityLabel="Add monitor"
      >
        <Text style={{ color: '#fff', fontSize: 26, marginTop: -2 }}>+</Text>
      </Pressable>
    </View>
  );
}
