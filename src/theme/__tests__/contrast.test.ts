import { brand, darkTheme, lightTheme, Theme } from '@/theme/index';

// WCAG 2.x: relative Luminanz und Kontrastverhältnis.
function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

// Jede in der App vorkommende Text/Hintergrund-Kombination. mutedSoft fehlt
// bewusst: nur dekorativ, nie für lesbaren Text.
function textCombos(t: Theme): [string, string, string][] {
  const c = t.colors;
  return [
    ['ink auf canvas', c.ink, c.canvas],
    ['bodyStrong auf canvas', c.bodyStrong, c.canvas],
    ['body auf canvas', c.body, c.canvas],
    ['muted auf canvas', c.muted, c.canvas],
    ['ink auf surfaceSoft (Eingabefelder)', c.ink, c.surfaceSoft],
    ['muted auf surfaceSoft (Platzhalter)', c.muted, c.surfaceSoft],
    ['onAction auf action (Buttons)', c.onAction, c.action],
    ['errorText auf canvas (Fehlertext)', c.errorText, c.canvas],
  ];
}

describe.each([
  ['Light', lightTheme],
  ['Dark', darkTheme],
])('Kontrast %s Mode (WCAG AA, 4.5:1)', (_name, theme) => {
  test.each(textCombos(theme))('%s', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  test('jede Rollo-Karte: Text auf Kartenfarbe', () => {
    for (const card of theme.cards) {
      expect(contrastRatio(card.fg, card.bg)).toBeGreaterThanOrEqual(AA);
    }
  });

  test('jede Rollo-Karte: Button-Label auf Button-Fläche', () => {
    for (const card of theme.cards) {
      expect(contrastRatio(card.buttonFg, card.buttonBg)).toBeGreaterThanOrEqual(AA);
    }
  });

  test('Statusleiste: Text auf Statusfläche', () => {
    for (const status of Object.values(theme.status)) {
      expect(contrastRatio(status.fg, status.bg)).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('bewusste Systemregeln', () => {
  test('Weiß auf Pink bleibt verboten (Beleg: unter 4.5:1)', () => {
    expect(contrastRatio('#ffffff', brand.pink)).toBeLessThan(AA);
  });

  test('Coral trägt in keiner Rotation Text', () => {
    for (const theme of [lightTheme, darkTheme]) {
      expect(theme.cards.some((card) => card.bg === brand.coral)).toBe(false);
    }
  });

  test('Teal verschwindet im Dark Mode aus der Rotation (1.45:1 gegen Canvas)', () => {
    expect(contrastRatio(brand.teal, darkTheme.colors.canvas)).toBeLessThan(3);
    expect(darkTheme.cards.some((card) => card.bg === brand.teal)).toBe(false);
    expect(darkTheme.cards.some((card) => card.bg === brand.mint)).toBe(true);
  });

  test('Kartenfarben heben sich vom dunklen Canvas ab (mind. 3:1 flächig)', () => {
    for (const card of darkTheme.cards.slice(0, 5)) {
      expect(contrastRatio(card.bg, darkTheme.colors.canvas)).toBeGreaterThanOrEqual(3);
    }
  });
});
