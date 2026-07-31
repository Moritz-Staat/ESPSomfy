import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, Theme } from '@/theme/index';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'themePreference';

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // useColorScheme abonniert die Systemeinstellung — Umschalten wirkt ohne Neustart.
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const mode = preference === 'system' ? (systemScheme ?? 'light') : preference;
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: mode === 'dark' ? darkTheme : lightTheme,
      preference,
      setPreference,
    }),
    [mode, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemePreference() {
  const { preference, setPreference } = useContext(ThemeContext);
  return { preference, setPreference };
}
