import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionBar } from '@/components/ConnectionBar';
import { PositionSlider } from '@/components/PositionSlider';
import { hasFavorite, isMoving, ShadeType, TiltType } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { sendShadeCommand, sendShadeTarget } from '@/store/service';
import { colors, spacing } from '@/theme/index';

export default function ShadeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shade = useAppStore((s) => s.shadesById[Number(id)]);

  if (!shade) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Rollo' }} />
        <Text style={styles.empty}>Rollo nicht gefunden.</Text>
      </View>
    );
  }

  const moving = isMoving(shade);
  const myLabel = moving ? 'Stopp' : hasFavorite(shade.myPos) ? 'Favorit' : 'My';
  const isDry =
    shade.shadeType === ShadeType.drycontact || shade.shadeType === ShadeType.drycontact2;
  // tiltonly hat keine Fahrposition → Positions-Slider ausblenden.
  const showSlider = !isDry && shade.tiltType !== TiltType.tiltonly;

  const send = (command: Parameters<typeof sendShadeCommand>[1]) => {
    sendShadeCommand(shade.shadeId, command).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: shade.name }} />
      <ConnectionBar />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.status}>
          {moving
            ? shade.direction < 0
              ? 'öffnet…'
              : 'schließt…'
            : `Position: ${shade.position} %`}
        </Text>
        {hasFavorite(shade.myPos) && <Text style={styles.meta}>Favorit: {shade.myPos} %</Text>}

        {showSlider && (
          <PositionSlider
            value={shade.position}
            // Nur beim Loslassen senden — kontinuierliches Senden flutet den ESP32.
            onCommit={(value) => {
              sendShadeTarget(shade.shadeId, value).catch(() => {});
            }}
          />
        )}

        <View style={styles.buttons}>
          {isDry ? (
            <Pressable style={styles.button} onPress={() => send('Toggle')}>
              <Text style={styles.buttonText}>Schalten</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.button} onPress={() => send('Up')}>
                <Text style={styles.buttonText}>Hoch</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={() => send('My')}>
                <Text style={styles.buttonText}>{myLabel}</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={() => send('Down')}>
                <Text style={styles.buttonText}>Runter</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', padding: spacing.xl },
  status: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  meta: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.m },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl * 2 },
  buttons: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.xl },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
