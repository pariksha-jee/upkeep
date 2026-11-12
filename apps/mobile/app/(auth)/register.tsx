import { useState } from 'react';
import { Link, router } from 'expo-router';
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

export default function RegisterScreen(): React.ReactElement {
  const { theme } = useTheme();
  const setTokens = useAuth((s) => s.setTokens);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (password.length < 10) {
      setError('Password must be at least 10 characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.register({ name: name.trim(), email: email.trim(), password });
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
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 14, justifyContent: 'center', flexGrow: 1 }}
      >
        <Text
          style={{ color: theme.primary, fontSize: 28, fontWeight: '800', textAlign: 'center' }}
        >
          Upkeep
        </Text>
        <Text
          style={{ color: theme.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 10 }}
        >
          Create your account
        </Text>
        <TextInput
          placeholder="Name"
          placeholderTextColor={theme.textMuted}
          value={name}
          onChangeText={setName}
          style={inputStyle}
        />
        <TextInput
          placeholder="Email"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <TextInput
          placeholder="Password (min 10 chars)"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={inputStyle}
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
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Create account</Text>
          )}
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <Text style={{ color: theme.textMuted }}>Already registered? </Text>
          <Link href="/(auth)/login" style={{ color: theme.primary, fontWeight: '600' }}>
            Sign in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
