import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { ConnectionBar } from '@/components/ConnectionBar';
import { GroupCard } from '@/components/GroupCard';
import { ShadeCard } from '@/components/ShadeCard';
import { Shade } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { GroupSummary, selectGroupSummaries, selectRoomSections } from '@/store/selectors';
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

// Eine Sektion trägt entweder Rollos oder Gruppen — beide bekommen dieselbe
// Überschriftenzeile, aber eine eigene Karte.
type Section =
  | { title: string; kind: 'shades'; data: Shade[] }
  | { title: string; kind: 'groups'; data: GroupSummary[] };

export default function Dashboard() {
  const shadesById = useAppStore((s) => s.shadesById);
  const roomsById = useAppStore((s) => s.roomsById);
  const groupsById = useAppStore((s) => s.groupsById);
  const device = useAppStore((s) => s.device);
  const { colors } = useTheme();
  const sections = useMemo<Section[]>(() => {
    // Gruppen zuerst: ein Gruppenbefehl erreicht alle Motoren mit einem einzigen
    // Funkbefehl und ist damit der schnellere Weg als Rollo für Rollo.
    const groups = selectGroupSummaries({ groupsById, shadesById });
    const groupSection: Section[] = groups.length
      ? [{ title: 'Gruppen', kind: 'groups', data: groups }]
      : [];
    return [
      ...groupSection,
      ...selectRoomSections({ shadesById, roomsById }).map(
        (section): Section => ({ title: section.title, kind: 'shades', data: section.shades })
      ),
    ];
  }, [shadesById, roomsById, groupsById]);

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen
        options={{ title: device?.hostname ?? 'Rollos', headerRight: () => <ThemeToggle /> }}
      />
      <ConnectionBar />
      <SectionList<Shade | GroupSummary, Section>
        sections={sections}
        keyExtractor={(item) =>
          'shadeId' in item ? `shade-${item.shadeId}` : `group-${item.group.groupId}`
        }
        renderItem={({ item }) =>
          'shadeId' in item ? <ShadeCard shade={item} /> : <GroupCard summary={item} />
        }
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
