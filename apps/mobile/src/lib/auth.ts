import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthTokensDto, UserDto } from '@upkeep/core';
import { UpkeepClient } from '@upkeep/api-client';

const TOKENS_KEY = 'upkeep.tokens';

interface AuthState {
  hydrated: boolean;
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrate: () => Promise<void>;
  setTokens: (t: AuthTokensDto) => Promise<void>;
  clear: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  hydrated: false,
  user: null,
  accessToken: null,
  refreshToken: null,

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(TOKENS_KEY);
      if (raw !== null) {
        const tokens = JSON.parse(raw) as {
          accessToken: string;
          refreshToken: string;
          user: UserDto;
        };
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: tokens.user,
        });
      }
    } catch {
      // secure store unavailable — stay logged out
    }
    set({ hydrated: true });
  },

  setTokens: async (t) => {
    set({ accessToken: t.accessToken, refreshToken: t.refreshToken, user: t.user });
    await SecureStore.setItemAsync(
      TOKENS_KEY,
      JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken, user: t.user }),
    ).catch(() => undefined);
  },

  clear: async () => {
    set({ accessToken: null, refreshToken: null, user: null });
    await SecureStore.deleteItemAsync(TOKENS_KEY).catch(() => undefined);
  },
}));

// 10.0.2.2 = host loopback from the Android emulator.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

/** Bearer-token client bound to the auth store (auto-refresh on 401). */
export function createMobileClient(): UpkeepClient {
  return new UpkeepClient({
    baseUrl: BASE_URL,
    getAccessToken: () => useAuth.getState().accessToken,
    getRefreshToken: () => useAuth.getState().refreshToken,
    onTokens: (tokens) => {
      void useAuth.getState().setTokens(tokens);
    },
  });
}

export const api = createMobileClient();
export const API_BASE_URL = BASE_URL;
