/**
 * Mobile theme — mirrors the web design tokens (apps/web/src/styles/tokens.css).
 * One visual language across platforms.
 */

export const palette = {
  brand50: '#eef2ff',
  brand600: '#4f46e5',
  brand700: '#4338ca',
  success: '#16a34a',
  successSoft: '#dcfce7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  gray50: '#f9fafb',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray900: '#111827',
} as const;

export interface Theme {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  statusUp: string;
  statusUpSoft: string;
  statusDown: string;
  statusDownSoft: string;
  statusPaused: string;
  statusPausedSoft: string;
  statusPending: string;
  statusPendingSoft: string;
}

export const lightTheme: Theme = {
  background: '#f4f5f8',
  surface: '#ffffff',
  textPrimary: palette.gray900,
  textSecondary: palette.gray600,
  textMuted: palette.gray500,
  border: palette.gray200,
  primary: palette.brand600,
  statusUp: palette.success,
  statusUpSoft: palette.successSoft,
  statusDown: palette.danger,
  statusDownSoft: palette.dangerSoft,
  statusPaused: palette.gray300,
  statusPausedSoft: palette.gray50,
  statusPending: palette.warning,
  statusPendingSoft: palette.warningSoft,
};

export const darkTheme: Theme = {
  background: '#0b0f1a',
  surface: '#111827',
  textPrimary: '#f3f4f6',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  border: '#2b3648',
  primary: '#6366f1',
  statusUp: '#34d399',
  statusUpSoft: 'rgba(52,211,153,0.14)',
  statusDown: '#f87171',
  statusDownSoft: 'rgba(248,113,113,0.14)',
  statusPaused: '#64748b',
  statusPausedSoft: 'rgba(100,116,139,0.16)',
  statusPending: '#fbbf24',
  statusPendingSoft: 'rgba(251,191,36,0.14)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 999,
} as const;
