import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/index';

const TRACK_HEIGHT = 320;
const THUMB_SIZE = 36;

interface Props {
  // Aktuelle Position 0–100 (0 = offen/oben, 100 = geschlossen/unten).
  value: number;
  // Wird NUR beim Loslassen aufgerufen — kontinuierliches Senden würde den ESP32 fluten.
  onCommit: (value: number) => void;
}

export function PositionSlider({ value, onCommit }: Props) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const startValue = useRef(0);
  // Refs, damit der einmalig erzeugte PanResponder aktuelle Props sieht.
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    valueRef.current = value;
    onCommitRef.current = onCommit;
  });

  // PanResponder ist ein imperatives API: die einmal erzeugten Handler leben über
  // Renders hinweg und lesen aktuelle Werte über Refs — nie während des Renderns.
  // useState-Initializer statt useMemo, damit der React Compiler nicht eingreift.
  // eslint-disable-next-line react-hooks/refs -- Refs werden nur in Gesture-Callbacks gelesen, nie im Render.
  const [responder] = useState(() => {
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValue.current = valueRef.current;
        setDragValue(valueRef.current);
      },
      onPanResponderMove: (_evt, gesture) => {
        const delta = (gesture.dy / (TRACK_HEIGHT - THUMB_SIZE)) * 100;
        setDragValue(clamp(startValue.current + delta));
      },
      onPanResponderRelease: (_evt, gesture) => {
        const delta = (gesture.dy / (TRACK_HEIGHT - THUMB_SIZE)) * 100;
        const committed = clamp(startValue.current + delta);
        setDragValue(null);
        onCommitRef.current(committed);
      },
      onPanResponderTerminate: () => setDragValue(null),
    });
  });

  const shown = dragValue ?? value;
  const top = ((TRACK_HEIGHT - THUMB_SIZE) * shown) / 100;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>0 % — offen</Text>
      <View style={styles.track} {...responder.panHandlers}>
        <View style={[styles.fill, { height: top + THUMB_SIZE / 2 }]} />
        <View style={[styles.thumb, { top }]}>
          <Text style={styles.thumbText}>{shown}</Text>
        </View>
      </View>
      <Text style={styles.label}>100 % — geschlossen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: { color: colors.textMuted, fontSize: 12, marginVertical: 8 },
  track: {
    height: TRACK_HEIGHT,
    width: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primary,
    opacity: 0.25,
  },
  thumb: {
    position: 'absolute',
    alignSelf: 'center',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
