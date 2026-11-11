'use client';

import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setSidebarOpen: (v: boolean) => void;
}

function applyTheme(t: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t);
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('upkeep-theme', t);
    } catch {
      // private mode — ignore
    }
  }
}

export function initTheme(): void {
  let stored: Theme | null = null;
  try {
    stored = localStorage.getItem('upkeep-theme') as Theme | null;
  } catch {
    stored = null;
  }
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(stored ?? (prefersDark ? 'dark' : 'light'));
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'light',
  sidebarOpen: false,
  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}));
