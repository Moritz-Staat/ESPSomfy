import { StyleSheet, Text, View } from 'react-native';

import { Slider } from '@/components/ui/index';
import { CardStyle, flat, radius, spacing, type, withAlpha } from '@/theme/index';

const TRACK_WIDTH = 260;
const SLAT_COUNT = 5;
const SLAT_HEIGHT = 18;
// Ganz offen steht die Lamelle fast auf der Kante, geschlossen liegt sie flach
// zum Betrachter. Der Rest der Drehung bliebe ohnehin unsichtbar.
const MAX_ANGLE = 78;

interface Props {
  /** Aktueller Lamellenwinkel 0–100 (0 = offen, 100 = geschlossen). */
  value: number;
  /** Wird NUR beim Loslassen aufgerufen — kontinuierliches Senden flutet den ESP32. */
  onCommit: (value: number) => void;
  /** Karte, auf der das Element liegt (Detailansicht). */
  on: CardStyle;
}

// Tilt als eigene Achse: waagerechter Verlauf, damit er sich vom senkrechten
// Positions-Slider unterscheidet, und die Lamellen darüber als Anzeige —
// ein zweiter Balken wäre von der Fahrposition nicht zu unterscheiden.
export function TiltControl({ value, onCommit, on }: Props) {
  // 100 % = geschlossen = Lamelle voll zum Betrachter (0°).
  const angle = MAX_ANGLE * (1 - Math.max(0, Math.min(100, value)) / 100);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: on.fg }]}>Lamellen</Text>
      <View
        style={[styles.slats, { backgroundColor: withAlpha(on.fg, 0.12), borderColor: on.fg }]}
        accessibilityRole="image"
        accessibilityLabel={`Lamellen zu ${Math.round(value)} Prozent geschlossen`}
      >
        {Array.from({ length: SLAT_COUNT }, (_, i) => (
          <View
            key={i}
            style={[
              styles.slat,
              {
                backgroundColor: on.fg,
                transform: [{ perspective: 400 }, { rotateX: `${angle}deg` }],
              },
            ]}
          />
        ))}
      </View>
      <Slider
        value={value}
        onCommit={onCommit}
        on={on}
        width={TRACK_WIDTH}
        accessibilityLabel="Lamellenwinkel"
        style={styles.slider}
      />
      <View style={styles.scale}>
        <Text style={[styles.scaleText, { color: on.fg }]}>offen</Text>
        <Text style={[styles.scaleText, { color: on.fg }]}>geschlossen</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: spacing.xl },
  label: { ...type.label, marginBottom: spacing.m },
  slats: {
    ...flat,
    width: TRACK_WIDTH,
    borderRadius: radius.lg,
    borderWidth: 2,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    justifyContent: 'space-between',
    gap: spacing.s,
  },
  slat: {
    height: SLAT_HEIGHT,
    borderRadius: radius.xs,
  },
  slider: { marginTop: spacing.l },
  scale: {
    width: TRACK_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.s,
  },
  scaleText: { ...type.label, fontSize: 11 },
});
