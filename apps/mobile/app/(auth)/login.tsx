import { useState } from 'react';
import { Link, router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, useAuth } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';

export default function LoginScreen(): React.ReactElement {
  const { theme } = useTheme();
  const setTokens = useAuth((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.login(email.trim(), password);
      await setTokens(tokens);
      router.replace('/(tabs)/');
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
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text
          style={{ color: theme.primary, fontSize: 28, fontWeight: '800', textAlign: 'center' }}
        >
          Upkeep
        </Text>
        <Text
          style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 12 }}
        >
          Sign in to your monitoring account
        </Text>
        <TextInput
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          style={{
            backgroundColor: theme.surface,
            color: theme.textPrimary,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            padding: 14,
            fontSize: 16,
          }}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            backgroundColor: theme.surface,
            color: theme.textPrimary,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            padding: 14,
            fontSize: 16,
          }}
        />
        {error !== null ? (
          <Text style={{ color: theme.statusDown, fontSize: 13 }}>{error}</Text>
        ) : null}
        <Pressable
          onPress={() => void submit()}
          disabled={busy}
          style={{
            backgroundColor: busy ? theme.border : theme.primary,
            borderRadius: 10,
            padding: 15,
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Sign in</Text>
          )}
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <Text style={{ color: theme.textMuted }}>No account? </Text>
          <Link href="/(auth)/register" style={{ color: theme.primary, fontWeight: '600' }}>
            Create one
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
