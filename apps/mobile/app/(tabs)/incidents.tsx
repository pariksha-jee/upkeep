import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { api, useAuth } from '@/lib/auth';
import { StatusChip } from '@/components/StatusChip';
import { useTheme } from '@/components/ThemeProvider';
import { relativeTime } from '@/lib/format';

export default function IncidentsScreen(): React.ReactElement {
  const { theme } = useTheme();
  const accessToken = useAuth((s) => s.accessToken);
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mobile-incidents'],
    queryFn: () => api.listIncidents({ limit: 50 }),
    enabled: accessToken !== null,
    refetchInterval: 30_000,
  });

  const incidents = data?.data ?? [];

  return (
    <FlatList
      data={incidents}
      keyExtractor={(i) => i.id}
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
        <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 40 }}>
          {isLoading ? 'Loading incidents…' : 'No incidents — everything healthy.'}
        </Text>
      }
      renderItem={({ item }) => (
        <View
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 14,
            gap: 6,
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text
              style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 15 }}
              numberOfLines={1}
            >
              {item.monitorName}
            </Text>
            <StatusChip status={item.status === 'OPEN' ? 'DOWN' : 'UP'} />
          </View>
          <Text style={{ color: theme.statusDown, fontSize: 12 }}>
            {item.cause ?? 'check failed'}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>
            started {relativeTime(item.startedAt)}
            {item.resolvedAt !== null
              ? ` · resolved ${relativeTime(item.resolvedAt)}`
              : ' · ongoing'}
          </Text>
        </View>
      )}
    />
  );
}
