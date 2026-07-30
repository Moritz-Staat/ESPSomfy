import { StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/appStore';
import { colors } from '@/theme/index';

const LABELS = {
  connecting: 'Verbinde…',
  live: 'Live',
  polling: 'Abfrage alle 10 s (Socket getrennt)',
  offline: 'Offline',
} as const;

// Schmale Statusleiste unter dem Header.
export function ConnectionBar() {
  const status = useAppStore((s) => s.connectionStatus);
  return (
    <View style={[styles.bar, { backgroundColor: colors[status] }]}>
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 3,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
