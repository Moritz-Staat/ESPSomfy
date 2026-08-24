import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SortableEntry, SortableList } from '@/components/SortableList';
import { Button, ErrorNotice } from '@/components/ui/index';
import { Group, Room, Shade } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { reorderGroups, reorderRooms, reorderShades } from '@/store/management';
import { compareGroups } from '@/store/selectors';
import { font, spacing } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

type Tab = 'shades' | 'rooms' | 'groups';

const TABS: { key: Tab; label: string }[] = [
  { key: 'shades', label: 'Rollos' },
  { key: 'rooms', label: 'Räume' },
  { key: 'groups', label: 'Gruppen' },
];

const HINTS: Record<Tab, string> = {
  // Die Firmware vergibt sortOrder über die gesamte gesendete Liste, nicht je Raum.
  // Deshalb steht hier eine einzige Liste über alle Rollos: Innerhalb eines Raums
  // zählt am Ende genau diese Gesamtreihenfolge.
  shades:
    'Ein Rollo lässt sich nur in der Gesamtliste verschieben — im Dashboard bestimmt diese Reihenfolge die Abfolge innerhalb des jeweiligen Raums.',
  rooms: 'Die Reihenfolge der Raumabschnitte im Dashboard.',
  groups: 'Die Reihenfolge der Gruppen über den Räumen im Dashboard.',
};

interface List {
  entries: SortableEntry[];
  /** Bekommt immer die vollständige Reihenfolge — die Firmware vergibt sortOrder
      über die gesamte gesendete Liste. */
  commit: (ids: number[]) => Promise<void>;
  empty: string;
}

export default function Sort() {
  const shadesById = useAppStore((s) => s.shadesById);
  const roomsById = useAppStore((s) => s.roomsById);
  const groupsById = useAppStore((s) => s.groupsById);
  const { colors } = useTheme();

  const [tab, setTab] = useState<Tab>('shades');
  const [error, setError] = useState<unknown>(null);

  const shadeEntries = useMemo<SortableEntry[]>(
    () =>
      (Object.values(shadesById) as Shade[])
        .sort((a, b) => a.sortOrder - b.sortOrder || a.shadeId - b.shadeId)
        .map((shade) => ({
          id: shade.shadeId,
          label: shade.name,
          hint:
            shade.roomId && roomsById[shade.roomId]
              ? roomsById[shade.roomId].name
              : 'Ohne Raum',
        })),
    [shadesById, roomsById]
  );

  const roomEntries = useMemo<SortableEntry[]>(
    () =>
      (Object.values(roomsById) as Room[])
        .sort((a, b) => a.sortOrder - b.sortOrder || a.roomId - b.roomId)
        .map((room) => {
          const count = (Object.values(shadesById) as Shade[]).filter(
            (shade) => shade.roomId === room.roomId
          ).length;
          return {
            id: room.roomId,
            label: room.name,
            hint: `${count} ${count === 1 ? 'Rollo' : 'Rollos'}`,
          };
        }),
    [roomsById, shadesById]
  );

  const groupEntries = useMemo<SortableEntry[]>(
    () =>
      (Object.values(groupsById) as Group[]).sort(compareGroups).map((group) => ({
        id: group.groupId,
        label: group.name,
        hint: `${group.shades.length} ${group.shades.length === 1 ? 'Rollo' : 'Rollos'}`,
      })),
    [groupsById]
  );

  // Ein Wechsel der Registerkarte verwirft den Fehler: Er gehört zur Liste, die
  // gerade nicht mehr zu sehen ist.
  const select = (next: Tab) => {
    setTab(next);
    setError(null);
  };

  const lists: Record<Tab, List> = {
    shades: {
      entries: shadeEntries,
      commit: reorderShades,
      empty: 'Keine Rollos gefunden.',
    },
    rooms: {
      entries: roomEntries,
      commit: reorderRooms,
      empty: 'Noch kein Raum angelegt.',
    },
    groups: {
      entries: groupEntries,
      commit: reorderGroups,
      empty: 'Noch keine Gruppe angelegt.',
    },
  };
  const active = lists[tab];

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ title: 'Reihenfolge' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tabs}>
          {TABS.map(({ key, label }) => (
            <Button
              key={key}
              label={label}
              variant={key === tab ? 'primary' : 'secondary'}
              compact
              onPress={() => select(key)}
            />
          ))}
        </View>

        <ErrorNotice error={error} />

        <Text style={[styles.note, { color: colors.body }]}>{HINTS[tab]}</Text>

        {/* key: Beim Wechsel der Registerkarte eine frische Liste, sonst trüge die
            neue Liste die gemerkte Reihenfolge der alten mit sich herum. */}
        <SortableList
          key={tab}
          entries={active.entries}
          onCommit={active.commit}
          onError={setError}
          emptyText={active.empty}
        />

        <Text style={[styles.footnote, { color: colors.muted }]}>
          Die Reihenfolge liegt im Gerät und gilt damit auch für das Web-UI und andere
          Clients. Gespeichert wird kurz nach dem letzten Verschieben.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.l, paddingBottom: spacing.xxxl },
  tabs: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.l },
  note: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: spacing.m },
  footnote: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.l,
  },
});
