import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { ConnectionBar } from '@/components/ConnectionBar';
import { ShadeCard } from '@/components/ShadeCard';
import { useAppStore } from '@/store/appStore';
import { selectRoomSections } from '@/store/selectors';
import { colors, font, spacing, type } from '@/theme/index';

export default function Dashboard() {
  const shadesById = useAppStore((s) => s.shadesById);
  const roomsById = useAppStore((s) => s.roomsById);
  const device = useAppStore((s) => s.device);
  const sections = useMemo(
    () =>
      selectRoomSections({ shadesById, roomsById }).map((section) => ({
        title: section.title,
        data: section.shades,
      })),
    [shadesById, roomsById]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: device?.hostname ?? 'Rollos' }} />
      <ConnectionBar />
      <SectionList
        sections={sections}
        keyExtractor={(shade) => String(shade.shadeId)}
        renderItem={({ item }) => <ShadeCard shade={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Keine Rollos gefunden.</Text>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  // Raum-Überschrift 22/600/−0.3; 32 vor einem Raum, 12 bis zur ersten Karte.
  sectionHeader: {
    ...type.roomHeader,
    color: colors.ink,
    marginTop: spacing.xxl,
    marginBottom: spacing.m,
    marginHorizontal: spacing.l,
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    fontFamily: font.regular,
    marginTop: spacing.xxxl,
  },
});
