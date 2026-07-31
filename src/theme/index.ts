import type { TextStyle, ViewStyle } from 'react-native';

// Clay-Designsystem: warme Creme-Flächen, saturierte Farbkarten, keine Schatten.
// Kontrastregel: dunkler Text (ink) auf allen Kartenfarben außer Teal (dort Weiß).
// Weiß auf Pink (3.14:1) und Text auf Coral (2.80:1) sind verboten;
// mutedSoft (2.70:1 auf Canvas) ist nur dekorativ, nie für lesbaren Text.

export const brand = {
  pink: '#ff4d8b',
  teal: '#1a3a3a',
  lavender: '#b8a4ed',
  peach: '#ffb084',
  ochre: '#e8b94a',
  mint: '#a4d4c5',
  // Nie als Kartenfarbe mit Text (Weiß 2.80:1, ink knapp) — nur Akzent/Dekor.
  coral: '#ff6b5a',
} as const;

export interface ThemeColors {
  canvas: string;
  surfaceSoft: string;
  surfaceCard: string;
  surfaceStrong: string;
  hairline: string;
  ink: string;
  bodyStrong: string;
  body: string;
  muted: string;
  /** Nur dekorativ — nie für lesbaren Text (2.70:1 auf Canvas). */
  mutedSoft: string;
  onPrimary: string;
  /** Primäre Aktionen (Buttons): ink auf Creme-Label, 19:1. */
  action: string;
  onAction: string;
  success: string;
  warning: string;
  error: string;
}

export const lightColors: ThemeColors = {
  canvas: '#fffaf0',
  surfaceSoft: '#faf5e8',
  surfaceCard: '#f5f0e0',
  surfaceStrong: '#ebe6d6',
  hairline: '#e5e5e5',
  ink: '#0a0a0a',
  bodyStrong: '#1a1a1a',
  body: '#3a3a3a',
  muted: '#6a6a6a',
  mutedSoft: '#9a9a9a',
  onPrimary: '#ffffff',
  action: '#0a0a0a',
  onAction: '#fffaf0',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

/** Aktive Farbfläche der App — wird mit dem Dark Mode themenbewusst. */
export const colors = lightColors;

// Rollo-Karten: Rotation pink → teal → lavender → peach → ochre → creme.
// Die Farbe hängt an shadeId % 6 (nicht am Listenindex), damit sie bei
// Umsortierung stabil bleibt.
export interface CardStyle {
  bg: string;
  fg: string;
  /** Buttons auf der Karte: ink mit Creme-Label — auf Teal invertiert. */
  buttonBg: string;
  buttonFg: string;
}

const inkCard = (bg: string): CardStyle => ({
  bg,
  fg: lightColors.ink,
  buttonBg: lightColors.ink,
  buttonFg: lightColors.onAction,
});

export const cardRotation: readonly CardStyle[] = [
  inkCard(brand.pink),
  {
    bg: brand.teal,
    fg: lightColors.onPrimary,
    buttonBg: lightColors.onAction,
    buttonFg: lightColors.ink,
  },
  inkCard(brand.lavender),
  inkCard(brand.peach),
  inkCard(brand.ochre),
  inkCard(lightColors.surfaceCard),
];

export function cardStyleFor(shadeId: number): CardStyle {
  return cardRotation[Math.abs(shadeId) % cardRotation.length];
}

// Verbindungsstatus → Flächen mit kontrastkonformem Text (ink auf Semantikfarben,
// Weiß auf error wäre 3.15:1).
export const statusStyles: Record<
  'connecting' | 'live' | 'polling' | 'offline',
  { bg: string; fg: string }
> = {
  connecting: { bg: lightColors.surfaceStrong, fg: lightColors.body },
  live: { bg: lightColors.success, fg: lightColors.ink },
  polling: { bg: lightColors.warning, fg: lightColors.ink },
  offline: { bg: lightColors.error, fg: lightColors.ink },
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  /** Buttons, Eingabefelder */
  md: 12,
  /** Inhaltskarten */
  lg: 16,
  /** Rollo-Karten */
  xl: 24,
  pill: 9999,
} as const;

// Typografie-Rollen (Inter folgt mit eigenem Issue; Gewichte/Größen gelten schon).
export const type = {
  screenTitle: { fontSize: 32, fontWeight: '500', letterSpacing: -1 },
  roomHeader: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  shadeName: { fontSize: 17, fontWeight: '600' },
  positionValue: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' },
  button: { fontSize: 15, fontWeight: '600' },
} satisfies Record<string, TextStyle>;

// Tiefe entsteht allein aus Farbkontrast. elevation/shadowOpacity explizit auf 0,
// weil React Native auf Android sonst automatisch Schatten ergänzt.
export const flat: ViewStyle = { elevation: 0, shadowOpacity: 0 };
