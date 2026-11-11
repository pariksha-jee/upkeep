'use client';

import { create } from 'zustand';
import type { UserDto } from '@upkeep/core';

interface SessionState {
  user: UserDto | null;
  hydrated: boolean;
  setSession: (user: UserDto | null) => void;
  setHydrated: (v: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  hydrated: false,
  setSession: (user) => set({ user }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
