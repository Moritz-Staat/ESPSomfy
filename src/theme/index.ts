import type { TextStyle, ViewStyle } from 'react-native';

// Clay-Designsystem: warme Creme-Flächen, saturierte Farbkarten, keine Schatten.
// Kontrastregel: dunkler Text (ink) auf allen Kartenfarben außer Teal (dort Weiß).
// Weiß auf Pink (3.14:1) und Text auf Coral (2.80:1) sind verboten;
// mutedSoft ist nur dekorativ, nie für lesbaren Text.
//
// Dark Mode ist eine Erweiterung, kein Ableitungsprodukt: Die Wärme bleibt.
// Nur Canvas und Textfarben kippen, die Markenfarben bleiben unverändert —
// das Creme wechselt vom Hintergrund zur Schriftfarbe.

export const brand = {
  pink: '#ff4d8b',
  teal: '#1a3a3a',
  lavender: '#b8a4ed',
  peach: '#ffb084',
  ochre: '#e8b94a',
  mint: '#a4d4c5',
  // Nie als Kartenfarbe mit Text (Weiß 2.80:1) — nur Akzent/Dekor.
  coral: '#ff6b5a',
} as const;

// Feste Anker unabhängig vom Modus: Text auf Markenkarten ist immer ink,
// Karten-Buttons sind immer ink mit Creme-Label (auf Teal invertiert).
const INK = '#0a0a0a';
const CREAM = '#fffaf0';

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
  /** Nur dekorativ — nie für lesbaren Text. */
  mutedSoft: string;
  onPrimary: string;
  /** Primäre Aktionen (Buttons) auf Canvas. */
  action: string;
  onAction: string;
  success: string;
  warning: string;
  /** Semantikfläche (Statusleiste) — als Fließtext auf Canvas errorText nutzen. */
  error: string;
  /** Fehlertext auf Canvas (error selbst hat auf hellem Creme nur 3.6:1). */
  errorText: string;
}

export interface CardStyle {
  bg: string;
  fg: string;
  /** Buttons auf der Karte. */
  buttonBg: string;
  buttonFg: string;
}

export interface StatusStyle {
  bg: string;
  fg: string;
}

export interface Theme {
  mode: 'light' | 'dark';
  colors: ThemeColors;
  /** Rollo-Karten-Rotation; Index über shadeId % Länge (stabil bei Umsortierung). */
  cards: readonly CardStyle[];
  // Nur Abweichungen vom Normalzustand. „live" trägt keine Information und
  // bekommt deshalb keine Fläche — die Leiste bleibt dann ganz weg.
  status: Record<'connecting' | 'polling' | 'offline', StatusStyle>;
}

const inkCard = (bg: string): CardStyle => ({
  bg,
  fg: INK,
  buttonBg: INK,
  buttonFg: CREAM,
});

const lightColors: ThemeColors = {
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
  errorText: '#b91c1c',
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  // Rotation pink → teal → lavender → peach → ochre → creme.
  cards: [
    inkCard(brand.pink),
    { bg: brand.teal, fg: '#ffffff', buttonBg: CREAM, buttonFg: INK },
    inkCard(brand.lavender),
    inkCard(brand.peach),
    inkCard(brand.ochre),
    inkCard(lightColors.surfaceCard),
  ],
  // Ink auf den Semantikfarben — Weiß auf error wäre 3.15:1.
  status: {
    connecting: { bg: lightColors.surfaceStrong, fg: lightColors.body },
    polling: { bg: lightColors.warning, fg: INK },
    offline: { bg: lightColors.error, fg: INK },
  },
};

// Ankerflächen aus der Vorlage: surface-dark und surface-dark-elevated,
// befördert zu Canvas und zurückhaltender Karte. Kein kaltgraues #121212.
const darkColors: ThemeColors = {
  canvas: '#0a1a1a',
  surfaceSoft: '#1a2a2a',
  surfaceCard: '#1a2a2a',
  surfaceStrong: '#243434',
  hairline: '#2a3a3a',
  ink: '#fffaf0',
  bodyStrong: '#ede7d9',
  body: '#d8d2c4',
  muted: '#9aa5a0',
  mutedSoft: '#828d88',
  onPrimary: '#ffffff',
  action: '#fffaf0',
  onAction: '#0a1a1a',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  errorText: '#ef4444',
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  // Teal (1.45:1 gegen den dunklen Canvas) verschwindet — Mint übernimmt den Platz.
  // Rotation pink → mint → lavender → peach → ochre → Dunkelkarte.
  cards: [
    inkCard(brand.pink),
    inkCard(brand.mint),
    inkCard(brand.lavender),
    inkCard(brand.peach),
    inkCard(brand.ochre),
    { bg: darkColors.surfaceCard, fg: CREAM, buttonBg: CREAM, buttonFg: '#0a1a1a' },
  ],
  status: {
    connecting: { bg: darkColors.surfaceStrong, fg: darkColors.body },
    polling: { bg: darkColors.warning, fg: INK },
    offline: { bg: darkColors.error, fg: INK },
  },
};

export function cardStyleFor(theme: Theme, shadeId: number): CardStyle {
  return theme.cards[Math.abs(shadeId) % theme.cards.length];
}

// Detailansicht: Im Light Mode läuft der Screen vollflächig auf der Kartenfarbe.
// Im Dark Mode wäre das ein Systembruch — die saturierte Fläche erschlägt den
// warmen dunklen Canvas. Dort bleibt der Canvas stehen und die Rollo-Farbe wirkt
// als Akzent (Grafik, Slider-Füllung, Überschrift, Buttons).
export function detailStyleFor(theme: Theme, shadeId: number): CardStyle {
  const card = cardStyleFor(theme, shadeId);
  if (theme.mode === 'light') {
    return card;
  }
  // Die zurückhaltende Dunkelkarte hebt sich als Akzent nicht ab — dort Creme.
  const accent = card.bg === theme.colors.surfaceCard ? theme.colors.ink : card.bg;
  return {
    bg: theme.colors.canvas,
    fg: accent,
    buttonBg: accent,
    buttonFg: theme.colors.onAction,
  };
}

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

// Inter wird gebündelt über @expo-google-fonts/inter geladen (siehe app/_layout.tsx).
// Auf Android trägt die Font-Datei das Gewicht — fontFamily statt fontWeight,
// sonst synthetisiert das System ein zweites Bold darüber.
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

// Typografie-Rollen. Ersatz für die lizenzgebundene Original-Schrift der Vorlage:
// Inter mit negativem Letter-Spacing bei großen Größen.
export const type = {
  screenTitle: { fontFamily: font.medium, fontSize: 32, letterSpacing: -1 },
  roomHeader: { fontFamily: font.semibold, fontSize: 22, letterSpacing: -0.3 },
  shadeName: { fontFamily: font.semibold, fontSize: 17 },
  positionValue: { fontFamily: font.regular, fontSize: 15 },
  label: {
    fontFamily: font.semibold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  button: { fontFamily: font.semibold, fontSize: 15 },
} satisfies Record<string, TextStyle>;

// Tiefe entsteht allein aus Farbkontrast. elevation/shadowOpacity explizit auf 0,
// weil React Native auf Android sonst automatisch Schatten ergänzt.
export const flat: ViewStyle = { elevation: 0, shadowOpacity: 0 };

/** #rrggbb → rgba() — für Ton-in-Ton-Flächen (Slider-Track auf Farbkarten). */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
