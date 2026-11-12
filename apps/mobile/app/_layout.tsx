import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/lib/auth';
import { registerForPush } from '@/lib/push';

function Screens(): React.ReactElement {
  const { dark, theme } = useTheme();
  const accessToken = useAuth((s) => s.accessToken);

  useEffect(() => {
    void useAuth.getState().hydrate();
  }, []);

  useEffect(() => {
    if (accessToken !== null) {
      void registerForPush();
    }
  }, [accessToken]);

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.textPrimary,
          contentStyle: { backgroundColor: theme.background },
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="monitor/[id]" options={{ title: 'Monitor' }} />
        <Stack.Screen
          name="monitor/new"
          options={{ title: 'Add monitor', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout(): React.ReactElement {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 } },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <Screens />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
