import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { ConnectionBar } from '@/components/ConnectionBar';
import { ShadeCard } from '@/components/ShadeCard';
import { useAppStore } from '@/store/appStore';
import { selectRoomSections } from '@/store/selectors';
import { colors, spacing } from '@/theme/index';

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
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.l,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.l,
  },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl * 2 },
});
