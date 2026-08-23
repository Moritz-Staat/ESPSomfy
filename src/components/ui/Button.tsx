import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { CardStyle, flat, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** Zweitbelegung (z. B. Favoritendialog am My-Knopf). Nie der einzige Weg zu einer
      Funktion — ein langer Druck ist weder sichtbar noch gut bedienbar. */
  onLongPress?: () => void;
  variant?: ButtonVariant;
  /** Auf einer Farbkarte: Flächen und Label kommen aus dem Kartenstil. */
  card?: CardStyle;
  disabled?: boolean;
  busy?: boolean;
  /** Füllt die verfügbare Breite (Dialogfüße, Formulare). */
  block?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}

// Ersetzt die bis dahin direkt gestylten Pressables. Die Farbwahl steckt an einer
// Stelle, damit Formulare und Dialoge nicht jeder für sich eine Variante erfinden.
export function Button({
  label,
  onPress,
  onLongPress,
  variant = 'primary',
  card,
  disabled = false,
  busy = false,
  block = false,
  compact = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();

  let bg: string;
  let fg: string;
  if (card) {
    bg = card.buttonBg;
    fg = card.buttonFg;
  } else if (variant === 'secondary') {
    bg = colors.surfaceStrong;
    fg = colors.bodyStrong;
  } else if (variant === 'danger') {
    bg = colors.error;
    fg = colors.onError;
  } else {
    bg = colors.action;
    fg = colors.onAction;
  }

  const inactive = disabled || busy;

  return (
    <Pressable
      style={[
        styles.base,
        compact ? styles.compact : styles.roomy,
        block && styles.block,
        { backgroundColor: bg },
        inactive && styles.inactive,
        style,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, compact && styles.labelCompact, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    ...flat,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomy: { padding: spacing.l },
  compact: { paddingVertical: spacing.s, paddingHorizontal: spacing.m },
  block: { alignSelf: 'stretch' },
  inactive: { opacity: 0.6 },
  label: type.button,
  labelCompact: { fontSize: 13 },
});
