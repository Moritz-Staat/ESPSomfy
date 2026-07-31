import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { brand, CardStyle, flat, font, radius, spacing, type, withAlpha } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

const TRACK_HEIGHT = 320;
const THUMB_SIZE = 36;

interface Props {
  // Aktuelle Position 0–100 (0 = offen/oben, 100 = geschlossen/unten).
  value: number;
  // Wird NUR beim Loslassen aufgerufen — kontinuierliches Senden würde den ESP32 fluten.
  onCommit: (value: number) => void;
  // Gesetzt, wenn der Slider auf einer Farbkarte liegt (Detailansicht):
  // Track/Fill Ton-in-Ton aus der Textfarbe, Thumb wie die Karten-Buttons.
  on?: CardStyle;
}

export function PositionSlider({ value, onCommit, on }: Props) {
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

  const { colors } = useTheme();
  const labelStyle = [styles.label, { color: on ? on.fg : colors.muted }];
  const trackStyle = [
    styles.track,
    { backgroundColor: on ? withAlpha(on.fg, 0.15) : colors.surfaceStrong },
  ];
  const fillStyle = [styles.fill, { backgroundColor: on ? on.fg : brand.pink }];
  const thumbStyle = [styles.thumb, { backgroundColor: on ? on.buttonBg : colors.action }];
  const thumbTextStyle = [styles.thumbText, { color: on ? on.buttonFg : colors.onAction }];

  return (
    <View style={styles.container}>
      <Text style={labelStyle}>0 % — offen</Text>
      <View style={trackStyle} {...responder.panHandlers}>
        <View style={[...fillStyle, { height: top + THUMB_SIZE / 2 }]} />
        <View style={[...thumbStyle, { top }]}>
          <Text style={thumbTextStyle}>{shown}</Text>
        </View>
      </View>
      <Text style={labelStyle}>100 % — geschlossen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: { ...type.label, marginVertical: spacing.s },
  track: {
    height: TRACK_HEIGHT,
    width: 56,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0.25,
  },
  thumb: {
    ...flat,
    position: 'absolute',
    alignSelf: 'center',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: { fontFamily: font.semibold, fontSize: 12 },
});
