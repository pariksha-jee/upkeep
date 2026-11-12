import { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, useAuth } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';

const INTERVALS = [
  { v: 30, label: '30 seconds' },
  { v: 60, label: '1 minute' },
  { v: 300, label: '5 minutes' },
  { v: 600, label: '10 minutes' },
  { v: 900, label: '15 minutes' },
  { v: 1800, label: '30 minutes' },
  { v: 3600, label: '1 hour' },
];

export default function NewMonitorScreen(): React.ReactElement {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const accessToken = useAuth((s) => s.accessToken);

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [intervalIdx, setIntervalIdx] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    backgroundColor: theme.surface,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  };

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const intervalSeconds = (INTERVALS[intervalIdx]?.v ?? 60) as
        30 | 60 | 300 | 600 | 900 | 1800 | 3600;
      await api.createMonitor({
        type: 'HTTP',
        name: name.trim(),
        target: target.trim().startsWith('http') ? target.trim() : `https://${target.trim()}`,
        method: 'GET',
        intervalSeconds,
        timeoutMs: 10_000,
        failureThreshold: 2,
        recoveryThreshold: 2,
        channelIds: [],
      });
      await qc.invalidateQueries({ queryKey: ['mobile-monitors'] });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {error !== null ? (
          <Text style={{ color: theme.statusDown, fontSize: 13 }}>{error}</Text>
        ) : null}
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>Name</Text>
          <TextInput
            placeholder="Production API"
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            style={inputStyle}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>URL</Text>
          <TextInput
            placeholder="https://api.company.com/health"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            keyboardType="url"
            value={target}
            onChangeText={setTarget}
            style={inputStyle}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
            Interval
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INTERVALS.map((opt, idx) => (
              <Pressable
                key={opt.v}
                onPress={() => setIntervalIdx(idx)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: idx === intervalIdx ? theme.primary : theme.border,
                  backgroundColor: idx === intervalIdx ? theme.primary : theme.surface,
                }}
              >
                <Text
                  style={{
                    color: idx === intervalIdx ? '#fff' : theme.textSecondary,
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable
          onPress={() => void submit()}
          disabled={busy || accessToken === null}
          style={{
            backgroundColor: busy ? theme.border : theme.primary,
            borderRadius: 10,
            padding: 15,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Create monitor</Text>
          )}
        </Pressable>
        <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
          Tunnels and advanced options are configurable on the web dashboard.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
