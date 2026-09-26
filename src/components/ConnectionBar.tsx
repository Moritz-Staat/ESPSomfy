import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/appStore';
import { font } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

const LABELS = {
  connecting: 'Verbinde…',
  polling: 'Abfrage alle 10 s (Socket getrennt)',
  offline: 'Offline',
} as const;

// Solange die Leiste sichtbar ist, muss der Altersangabe jemand beim Altern helfen —
// ohne Events kommt kein Render. Eine Minute Takt genügt für eine Minutenangabe.
const TICK_MS = 60_000;

/** „vor 3 Min." — gerundet, ohne Sekunden: Genauer wäre nur unruhiger. */
export function formatAge(lastStateAt: number | null, now: number): string | null {
  if (lastStateAt === null) return null;
  const seconds = Math.floor((now - lastStateAt) / 1000);
  if (seconds < 0) return null;
  if (seconds < 60) return 'gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'vor einem Tag' : `vor ${days} Tagen`;
}

// Schmale Statusleiste unter dem Header — nur bei Abweichungen. Eine bestehende
// Verbindung ist der Normalfall und braucht kein dauerhaftes Band.
export function ConnectionBar() {
  const status = useAppStore((s) => s.connectionStatus);
  const lastStateAt = useAppStore((s) => s.lastStateAt);
  const theme = useTheme();
  const stale = status === 'offline' || status === 'polling';
  const [now, setNow] = useState(() => Date.now());

  // Die Uhrzeit darf weder im Render gelesen (unrein) noch im Effektkörper gesetzt
  // werden (Kaskadenrender) — beides verbietet der React-Compiler. Sie kommt daher
  // ausschließlich aus Callbacks: einmal unmittelbar nach dem Effekt, damit der
  // Wechsel nach offline nicht mit einem alten Zeitstempel rechnet, danach im Takt.
  useEffect(() => {
    if (!stale) return;
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const id = setInterval(update, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [stale]);

  if (status === 'live') {
    return null;
  }
  const { bg, fg } = theme.status[status];
  // Beim Verbinden ist das Alter des Bestands keine hilfreiche Information —
  // die Angabe gehört zu einem Stand, der gerade nicht nachgeführt wird.
  const age = stale ? formatAge(lastStateAt, now) : null;
  const label = age ? `${LABELS[status]} · Letzter Stand ${age}` : LABELS[status];
  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
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
