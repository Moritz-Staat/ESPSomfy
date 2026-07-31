import { StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/appStore';
import { font, statusStyles } from '@/theme/index';

const LABELS = {
  connecting: 'Verbinde…',
  live: 'Live',
  polling: 'Abfrage alle 10 s (Socket getrennt)',
  offline: 'Offline',
} as const;

// Schmale Statusleiste unter dem Header.
export function ConnectionBar() {
  const status = useAppStore((s) => s.connectionStatus);
  const { bg, fg } = statusStyles[status];
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
