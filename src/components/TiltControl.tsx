import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { CardStyle, flat, font, radius, spacing, type, withAlpha } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

const TRACK_WIDTH = 260;
const THUMB_SIZE = 36;
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
// Positions-Slider unterscheidet, und die Lamellen selbst als Bedienfläche —
// ein zweiter Balken wäre von der Fahrposition nicht zu unterscheiden.
export function TiltControl({ value, onCommit, on }: Props) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const startValue = useRef(0);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    valueRef.current = value;
    onCommitRef.current = onCommit;
  });

  // Gleiches Muster wie im PositionSlider: der PanResponder wird einmal erzeugt und
  // liest aktuelle Werte über Refs, nie während des Renderns.
  // eslint-disable-next-line react-hooks/refs -- Refs werden nur in Gesture-Callbacks gelesen.
  const [responder] = useState(() => {
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    const fromGesture = (dx: number) => clamp(startValue.current + (dx / (TRACK_WIDTH - THUMB_SIZE)) * 100);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValue.current = valueRef.current;
        setDragValue(valueRef.current);
      },
      onPanResponderMove: (_evt, gesture) => setDragValue(fromGesture(gesture.dx)),
      onPanResponderRelease: (_evt, gesture) => {
        const committed = fromGesture(gesture.dx);
        setDragValue(null);
        onCommitRef.current(committed);
      },
      onPanResponderTerminate: () => setDragValue(null),
    });
  });

  const shown = dragValue ?? value;
  const left = ((TRACK_WIDTH - THUMB_SIZE) * shown) / 100;
  // 100 % = geschlossen = Lamelle voll zum Betrachter (0°).
  const angle = MAX_ANGLE * (1 - shown / 100);

  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: on.fg }]}>Lamellen</Text>
      <View
        style={[styles.slats, { backgroundColor: withAlpha(on.fg, 0.12), borderColor: on.fg }]}
        accessibilityRole="adjustable"
        accessibilityLabel="Lamellenwinkel"
        accessibilityValue={{ min: 0, max: 100, now: shown }}
        {...responder.panHandlers}
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
      <View
        style={[styles.track, { backgroundColor: withAlpha(on.fg, 0.15) }]}
        {...responder.panHandlers}
      >
        <View style={[styles.fill, { backgroundColor: on.fg, width: left + THUMB_SIZE / 2 }]} />
        <View style={[styles.thumb, { backgroundColor: on.buttonBg, left }]}>
          <Text style={[styles.thumbText, { color: on.buttonFg }]}>{shown}</Text>
        </View>
      </View>
      <View style={styles.scale}>
        <Text style={[styles.scaleText, { color: on.fg }]}>offen</Text>
        <Text style={[styles.scaleText, { color: colors.mutedSoft }]} />
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
  track: {
    marginTop: spacing.l,
    width: TRACK_WIDTH,
    height: THUMB_SIZE,
    borderRadius: radius.pill,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.25,
  },
  thumb: {
    ...flat,
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: { fontFamily: font.semibold, fontSize: 12 },
  scale: {
    width: TRACK_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.s,
  },
  scaleText: { ...type.label, fontSize: 11 },
});
