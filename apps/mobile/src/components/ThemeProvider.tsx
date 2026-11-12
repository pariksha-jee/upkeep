import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme } from '@/theme';

interface ThemeContextValue {
  theme: Theme;
  dark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: lightTheme, dark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const value = useMemo(
    () => ({
      dark: system === 'dark',
      theme: system === 'dark' ? darkTheme : lightTheme,
    }),
    [system],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
