import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { ConnectionBar } from '@/components/ConnectionBar';
import { ShadeCard } from '@/components/ShadeCard';
import { useAppStore } from '@/store/appStore';
import { selectRoomSections } from '@/store/selectors';
import { font, spacing, type } from '@/theme/index';
import { ThemePreference, useTheme, useThemePreference } from '@/theme/ThemeContext';

const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const PREFERENCE_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
};

// Umschalter System → Hell → Dunkel im Header; Auswahl wird persistiert.
function ThemeToggle() {
  const { colors } = useTheme();
  const { preference, setPreference } = useThemePreference();
  return (
    <Pressable
      onPress={() => setPreference(NEXT_PREFERENCE[preference])}
      accessibilityLabel="Darstellung umschalten"
    >
      <Text style={[styles.toggle, { color: colors.muted }]}>
        {PREFERENCE_LABELS[preference]}
      </Text>
    </Pressable>
  );
}

export default function Dashboard() {
  const shadesById = useAppStore((s) => s.shadesById);
  const roomsById = useAppStore((s) => s.roomsById);
  const device = useAppStore((s) => s.device);
  const { colors } = useTheme();
  const sections = useMemo(
    () =>
      selectRoomSections({ shadesById, roomsById }).map((section) => ({
        title: section.title,
        data: section.shades,
      })),
    [shadesById, roomsById]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen
        options={{ title: device?.hostname ?? 'Rollos', headerRight: () => <ThemeToggle /> }}
      />
      <ConnectionBar />
      <SectionList
        sections={sections}
        keyExtractor={(shade) => String(shade.shadeId)}
        renderItem={({ item }) => <ShadeCard shade={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: colors.ink }]}>{section.title}</Text>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.muted }]}>Keine Rollos gefunden.</Text>
        }
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Raum-Überschrift 22/600/−0.3; 32 vor einem Raum, 12 bis zur ersten Karte.
  sectionHeader: {
    ...type.roomHeader,
    marginTop: spacing.xxl,
    marginBottom: spacing.m,
    marginHorizontal: spacing.l,
  },
  empty: {
    textAlign: 'center',
    fontFamily: font.regular,
    marginTop: spacing.xxxl,
  },
  toggle: { ...type.label, paddingHorizontal: spacing.s },
});
