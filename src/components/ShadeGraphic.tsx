import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CardStyle, flat, radius, withAlpha } from '@/theme/index';

const HEIGHT = 132;
const WIDTH = 108;
const SLAT_COUNT = 7;

interface Props {
  /** 0 = offen (Behang oben), 100 = geschlossen (Behang unten). */
  position: number;
  /** Karte, auf der die Grafik liegt — liefert Farbe und Kontrastpartner. */
  on: CardStyle;
}

// Claymation-Anmutung ohne Schatten: weiche, „getöpferte" Formen, Tiefe allein
// aus Ton-in-Ton-Flächen der Kartentextfarbe.
export function ShadeGraphic({ position, on }: Props) {
  const clamped = Math.max(0, Math.min(100, position));
  const slats = useMemo(() => Array.from({ length: SLAT_COUNT }, (_, i) => i), []);
  // Der Behang bedeckt den Ausschnitt anteilig; ein Rest bleibt als Kasten sichtbar.
  const panelHeight = 18 + ((HEIGHT - 30) * clamped) / 100;

  return (
    <View
      style={[styles.frame, { backgroundColor: withAlpha(on.fg, 0.12), borderColor: on.fg }]}
      accessibilityRole="image"
      accessibilityLabel={`Rollo zu ${clamped} Prozent geschlossen`}
    >
      <View style={[styles.panel, { height: panelHeight, backgroundColor: on.fg }]}>
        {slats.map((i) => (
          <View key={i} style={[styles.slat, { backgroundColor: withAlpha(on.bg, 0.35) }]} />
        ))}
      </View>
      <View style={[styles.sill, { backgroundColor: on.fg }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    ...flat,
    width: WIDTH,
    height: HEIGHT,
    borderRadius: radius.xl,
    borderWidth: 3,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  panel: {
    ...flat,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    justifyContent: 'space-evenly',
    paddingVertical: 4,
    overflow: 'hidden',
  },
  slat: {
    height: 2,
    marginHorizontal: 10,
    borderRadius: radius.pill,
  },
  sill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 8,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
});
