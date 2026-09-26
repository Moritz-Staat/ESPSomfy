import type { ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { describeError } from './ErrorNotice';
import { font, spacing, type } from '@/theme/index';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

// Auffangseite für Renderfehler. Expo Router besitzt dafür eine eigene Konvention:
// Ein Route- oder Layout-Modul exportiert `ErrorBoundary`, der Router hängt sie über
// `Try` davor und liefert `retry`, das den Routenbaum neu aufbaut. Eine selbst
// gebaute Klasse mit getDerivedStateFromError kann das nicht — sie setzt nur ihren
// eigenen State zurück, während der Router die Route wirklich neu montiert.
//
// Wichtig: Der Router rendert die Boundary *anstelle* des Layouts. Alles, was der
// Standard-Export des Layouts aufspannt, fehlt hier — deshalb bringt die Seite
// ihren ThemeProvider selbst mit, sonst stünde sie im Dunkelmodus in Hellfarben.
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <Fallback error={error} retry={retry} />
    </ThemeProvider>
  );
}

function Fallback({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Da ist etwas schiefgelaufen</Text>
      <Text style={[styles.body, { color: colors.body }]}>{describeError(error)}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        Der letzte bekannte Stand der Rollos bleibt gespeichert.
      </Text>
      <Button
        label="Nochmal versuchen"
        onPress={() => {
          retry().catch(() => {});
        }}
        block
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.m,
  },
  title: type.roomHeader,
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  button: { marginTop: spacing.l },
});
