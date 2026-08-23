import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Fehlertext unter dem Feld; färbt zugleich den Rand. */
  error?: string | null;
  hint?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, ...inputProps },
  ref
) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        ref={ref}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceSoft,
            // Der Rand trägt den Fehler mit — Farbe allein wäre kein Kriterium,
            // deshalb steht der Text darunter zusätzlich.
            borderColor: error ? colors.errorText : colors.hairline,
            color: colors.ink,
          },
        ]}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? (
        <Text style={[styles.helper, { color: colors.errorText }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: colors.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.l },
  label: { ...type.label, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.m,
    fontFamily: font.regular,
    fontSize: 16,
  },
  helper: { fontFamily: font.regular, fontSize: 13, marginTop: spacing.xs },
});
