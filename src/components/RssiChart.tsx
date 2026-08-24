import { StyleSheet, Text, View } from 'react-native';

import { RSSI_CEILING, RSSI_FLOOR, rssiFraction, signalLevel, WifiSample } from '@/models/index';
import { font, radius, spacing } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

/** So viele Balken passen nebeneinander, bevor sie zu Haaren werden. */
export const CHART_BARS = 60;

/** Die jüngsten `count` Messpunkte, ältester zuerst. */
export function recentSamples(history: WifiSample[], count = CHART_BARS): WifiSample[] {
  return history.length <= count ? history : history.slice(history.length - count);
}

/** Spanne des Ausschnitts in Minuten, aufgerundet — für die Beschriftung. */
export function spanMinutes(samples: WifiSample[]): number {
  if (samples.length < 2) return 0;
  return Math.max(1, Math.round((samples[samples.length - 1].at - samples[0].at) / 60_000));
}

// Kein Diagramm mit Achsenkreuz: Was hier zählt, ist der Verlauf — bricht das
// Signal regelmäßig ein, sieht man das an den Lücken in der Balkenhöhe. Balken aus
// gewöhnlichen Views kommen ohne react-native-svg aus.
export function RssiChart({ history }: { history: WifiSample[] }) {
  const { colors } = useTheme();
  const samples = recentSamples(history);

  if (samples.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.muted }]}>
        Noch keine Messwerte. Das Gerät meldet die Signalstärke nur, wenn sie sich
        ändert — bei stabilem Empfang kann das eine Weile dauern.
      </Text>
    );
  }

  const colorFor = (strength: number) => {
    const level = signalLevel(strength);
    if (level === 'good') return colors.success;
    if (level === 'fair') return colors.warning;
    return colors.error;
  };

  const span = spanMinutes(samples);
  const latest = samples[samples.length - 1];

  return (
    <View>
      <View style={[styles.plot, { backgroundColor: colors.surfaceSoft }]}>
        {samples.map((sample, index) => (
          <View
            key={`${sample.at}-${index}`}
            style={[
              styles.bar,
              {
                // Mindesthöhe, damit auch ein Totalausfall als Strich sichtbar bleibt
                // und nicht wie ein fehlender Messpunkt aussieht.
                height: `${Math.max(3, rssiFraction(sample.strength) * 100)}%`,
                backgroundColor: colorFor(sample.strength),
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisText, { color: colors.muted }]}>
          {span > 0 ? `letzte ${span} Min` : 'seit dem Verbinden'}
        </Text>
        <Text style={[styles.axisText, { color: colors.muted }]}>
          {RSSI_FLOOR} bis {RSSI_CEILING} dBm · zuletzt {latest.strength} dBm
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  plot: {
    height: 88,
    borderRadius: radius.md,
    padding: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: { flex: 1, borderRadius: 2, minWidth: 2 },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: spacing.s,
    gap: spacing.s,
  },
  axisText: { fontFamily: font.regular, fontSize: 12 },
});
