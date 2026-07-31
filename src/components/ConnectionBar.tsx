import { StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/appStore';
import { font } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

const LABELS = {
  connecting: 'Verbinde…',
  polling: 'Abfrage alle 10 s (Socket getrennt)',
  offline: 'Offline',
} as const;

// Schmale Statusleiste unter dem Header — nur bei Abweichungen. Eine bestehende
// Verbindung ist der Normalfall und braucht kein dauerhaftes Band.
export function ConnectionBar() {
  const status = useAppStore((s) => s.connectionStatus);
  const theme = useTheme();
  if (status === 'live') {
    return null;
  }
  const { bg, fg } = theme.status[status];
  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 3,
    alignItems: 'center',
  },
  text: {
    fontFamily: font.semibold,
    fontSize: 11,
  },
});
