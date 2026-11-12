import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { api, useAuth } from '@/lib/auth';
import { registerForPush } from '@/lib/push';
import { useTheme } from '@/components/ThemeProvider';

export default function SettingsScreen(): React.ReactElement {
  const { theme } = useTheme();
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const [pushBusy, setPushBusy] = useState(false);

  async function logout(): Promise<void> {
    await api.logout().catch(() => undefined);
    await clear();
    router.replace('/(auth)/login');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, padding: 16, gap: 12 }}>
      <View
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: 16,
          gap: 4,
        }}
      >
        <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>
          {user?.name ?? '—'}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>{user?.email ?? ''}</Text>
      </View>

      <Pressable
        onPress={async () => {
          setPushBusy(true);
          const ok = await registerForPush();
          setPushBusy(false);
          Alert.alert(
            ok ? 'Push enabled' : 'Push unavailable',
            ok
              ? 'This device will receive down/recovery alerts.'
              : 'Notifications were denied or are unavailable on this device/emulator.',
          );
        }}
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: 16,
        }}
      >
        {pushBusy ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 15 }}>
            Enable push notifications
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => void logout()}
        style={{
          backgroundColor: theme.statusDownSoft,
          borderWidth: 1,
          borderColor: theme.statusDown,
          borderRadius: 12,
          padding: 16,
          marginTop: 'auto',
        }}
      >
        <Text
          style={{ color: theme.statusDown, fontWeight: '700', fontSize: 15, textAlign: 'center' }}
        >
          Sign out
        </Text>
      </Pressable>

      <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
        Upkeep mobile v0.1.0 · Android first
      </Text>
    </View>
  );
}
