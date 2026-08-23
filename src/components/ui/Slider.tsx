import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { CardStyle, flat, font, radius, withAlpha } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

const THUMB_SIZE = 36;

export interface SliderProps {
  /** Aktueller Wert 0–100. */
  value: number;
  /** Wird NUR beim Loslassen aufgerufen — kontinuierliches Senden flutet den ESP32. */
  onCommit: (value: number) => void;
  /** Optional: Karte, auf der der Slider liegt (Ton-in-Ton statt Canvas-Farben). */
  on?: CardStyle;
  width: number;
  accessibilityLabel: string;
  style?: ViewStyle;
}

// Waagerechter Wertregler. Die Fahrposition hat ihren eigenen, senkrechten Slider —
// dessen Achse trägt Bedeutung (oben offen, unten geschlossen). Überall sonst,
// wo ein Wert 0–100 einzustellen ist, läuft es über diesen hier.
export function Slider({
  value,
  onCommit,
  on,
  width,
  accessibilityLabel,
  style,
}: SliderProps) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const startValue = useRef(0);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const widthRef = useRef(width);
  useEffect(() => {
    valueRef.current = value;
    onCommitRef.current = onCommit;
    widthRef.current = width;
  });

  // PanResponder ist ein imperatives API: die einmal erzeugten Handler leben über
  // Renders hinweg und lesen aktuelle Werte über Refs, nie während des Renderns.
  // eslint-disable-next-line react-hooks/refs -- Refs werden nur in Gesture-Callbacks gelesen.
  const [responder] = useState(() => {
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    const fromGesture = (dx: number) =>
      clamp(startValue.current + (dx / (widthRef.current - THUMB_SIZE)) * 100);
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

  const { colors } = useTheme();
  const shown = dragValue ?? value;
  const left = ((width - THUMB_SIZE) * shown) / 100;
  const trackBg = on ? withAlpha(on.fg, 0.15) : colors.surfaceStrong;
  const fillBg = on ? on.fg : colors.action;
  const thumbBg = on ? on.buttonBg : colors.action;
  const thumbFg = on ? on.buttonFg : colors.onAction;

  return (
    <View
      style={[styles.track, { width, backgroundColor: trackBg }, style]}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: shown }}
      {...responder.panHandlers}
    >
      <View style={[styles.fill, { backgroundColor: fillBg, width: left + THUMB_SIZE / 2 }]} />
      <View style={[styles.thumb, { backgroundColor: thumbBg, left }]}>
        <Text style={[styles.thumbText, { color: thumbFg }]}>{shown}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
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
});
