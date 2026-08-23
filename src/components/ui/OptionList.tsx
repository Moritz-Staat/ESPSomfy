import { Pressable, StyleSheet, Text, View } from 'react-native';

import { flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

export interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

export interface OptionListProps<T> {
  label?: string;
  options: Option<T>[];
  /** Einfachauswahl: ein Wert. Mehrfachauswahl: ein Array (siehe multiple). */
  selected: T | T[];
  onSelect: (value: T) => void;
  multiple?: boolean;
  emptyText?: string;
}

// Auswahl für „Raum zuweisen" und „Gruppenmitglieder". Bewusst als Liste statt
// als Systempicker: der Picker sieht auf beiden Plattformen anders aus und ließe
// sich nicht in das Clay-System einpassen.
export function OptionList<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  multiple = false,
  emptyText = 'Nichts vorhanden.',
}: OptionListProps<T>) {
  const { colors } = useTheme();
  const isSelected = (value: T) =>
    Array.isArray(selected) ? selected.includes(value) : selected === value;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>}
      {options.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>
      ) : (
        options.map((option) => {
          const active = isSelected(option.value);
          return (
            <Pressable
              key={String(option.value)}
              style={[
                styles.row,
                {
                  backgroundColor: active ? colors.surfaceStrong : colors.surfaceSoft,
                  borderColor: active ? colors.action : colors.hairline,
                },
              ]}
              onPress={() => onSelect(option.value)}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: active }}
              accessibilityLabel={option.label}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.ink }]}>{option.label}</Text>
                {/* body statt muted: auf surfaceStrong (gewählte Zeile) kommt muted
                    im Hellen nur auf 4.33:1. Zurückgenommen wirkt der Zusatz
                    hier über Schriftgröße und Position. */}
                {option.hint && (
                  <Text style={[styles.rowHint, { color: colors.body }]}>{option.hint}</Text>
                )}
              </View>
              {/* Zeichen statt Farbe allein — die Auswahl muss ohne Farbsehen erkennbar sein. */}
              {active && <Text style={[styles.check, { color: colors.ink }]}>✓</Text>}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.l },
  label: { ...type.label, marginBottom: spacing.xs },
  empty: { fontFamily: font.regular, fontSize: 15, paddingVertical: spacing.s },
  row: {
    ...flat,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    marginBottom: spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: font.medium, fontSize: 16 },
  rowHint: { fontFamily: font.regular, fontSize: 13, marginTop: 2 },
  check: { fontFamily: font.semibold, fontSize: 16, marginLeft: spacing.m },
});
