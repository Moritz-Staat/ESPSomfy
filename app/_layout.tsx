import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ErrorScreen, ToastProvider } from '@/components/ui';
import { font } from '@/theme/index';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

// Splash halten, bis die Fonts bereit sind — kein Textblitz mit Systemschrift.
SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedStack() {
  const { colors, mode } = useTheme();
  return (
    <>
      {/* Statusbar-Symbole invers zum Canvas des aktiven Themes. */}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { color: colors.ink, fontFamily: font.semibold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </>
  );
}

// Expo Router zieht diesen benannten Export als Auffangseite für Renderfehler
// unterhalb dieses Layouts heran und liefert `retry`, das die Route neu montiert.
export { ErrorScreen as ErrorBoundary };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      {/* Der Toast liegt über der Navigation, damit eine Meldung einen
          Screenwechsel übersteht — ein Befehl darf unterwegs scheitern. */}
      <ToastProvider>
        <ThemedStack />
      </ToastProvider>
    </ThemeProvider>
  );
}
