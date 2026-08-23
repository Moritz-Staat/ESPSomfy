import { StyleSheet, Text, View } from 'react-native';

import { ApiError, TimeoutError } from '@/api/client';
import { font, radius, spacing } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

// Übersetzt, was aus der Firmware und dem Client an Fehlern hochkommt. Die Firmware
// antwortet englisch und wortkarg ({status, desc}) — für die bekannten Fälle steht
// hier ein verständlicher deutscher Text.
export function describeError(err: unknown): string {
  if (err instanceof TimeoutError) {
    return 'Das Gerät hat nicht geantwortet. Verbindung prüfen und erneut versuchen.';
  }
  if (err instanceof ApiError) {
    const desc = err.desc ?? '';
    if (desc.includes('member of a group')) {
      return 'Dieses Rollo gehört zu einer Gruppe und lässt sich erst nach dem Entfernen aus der Gruppe löschen.';
    }
    if (desc.includes('Maximum number of rooms')) {
      return 'Die Höchstzahl an Räumen ist erreicht (16).';
    }
    if (desc.includes('Maximum number of groups')) {
      return 'Die Höchstzahl an Gruppen ist erreicht (16).';
    }
    if (desc.includes('not found')) {
      return 'Das Gerät kennt diesen Eintrag nicht mehr. Ansicht aktualisieren.';
    }
    return desc || `Das Gerät hat mit HTTP ${err.status} geantwortet.`;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Unbekannter Fehler.';
}

export function ErrorNotice({ error }: { error: unknown }) {
  const { colors } = useTheme();
  if (!error) return null;
  return (
    <View style={[styles.box, { borderColor: colors.errorText }]}>
      <Text style={[styles.text, { color: colors.errorText }]}>{describeError(error)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.m,
    marginBottom: spacing.l,
  },
  text: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
});
