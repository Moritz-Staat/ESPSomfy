import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionBar } from '@/components/ConnectionBar';
import { PositionSlider } from '@/components/PositionSlider';
import { hasFavorite, isMoving, ShadeType, TiltType } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { sendShadeCommand, sendShadeTarget } from '@/store/service';
import { cardStyleFor, flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

export default function ShadeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shade = useAppStore((s) => s.shadesById[Number(id)]);
  const theme = useTheme();

  if (!shade) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.colors.canvas }]}>
        <Stack.Screen options={{ title: 'Rollo' }} />
        <Text style={[styles.empty, { color: theme.colors.muted }]}>Rollo nicht gefunden.</Text>
      </View>
    );
  }

  const moving = isMoving(shade);
  const myLabel = moving ? 'Stopp' : hasFavorite(shade.myPos) ? 'Favorit' : 'My';
  const isDry =
    shade.shadeType === ShadeType.drycontact || shade.shadeType === ShadeType.drycontact2;
  // tiltonly hat keine Fahrposition → Positions-Slider ausblenden.
  const showSlider = !isDry && shade.tiltType !== TiltType.tiltonly;
  // Die Karte „öffnet sich" zum Screen: Flächenfarbe = Kartenfarbe des Rollos.
  const card = cardStyleFor(theme, shade.shadeId);

  const send = (command: Parameters<typeof sendShadeCommand>[1]) => {
    sendShadeCommand(shade.shadeId, command).catch(() => {});
  };

  const buttonStyle = [styles.button, { backgroundColor: card.buttonBg }];
  const buttonTextStyle = [styles.buttonText, { color: card.buttonFg }];

  return (
    <View style={[styles.container, { backgroundColor: card.bg }]}>
      <Stack.Screen
        options={{
          title: shade.name,
          headerStyle: { backgroundColor: card.bg },
          headerTintColor: card.fg,
          headerTitleStyle: { color: card.fg },
        }}
      />
      <ConnectionBar />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.status, { color: card.fg }]}>
          {moving
            ? shade.direction < 0
              ? 'öffnet…'
              : 'schließt…'
            : `Position: ${shade.position} %`}
        </Text>
        {hasFavorite(shade.myPos) && (
          <Text style={[styles.meta, { color: card.fg }]}>Favorit: {shade.myPos} %</Text>
        )}

        {showSlider && (
          <PositionSlider
            value={shade.position}
            on={card}
            // Nur beim Loslassen senden — kontinuierliches Senden flutet den ESP32.
            onCommit={(value) => {
              sendShadeTarget(shade.shadeId, value).catch(() => {});
            }}
          />
        )}

        <View style={styles.buttons}>
          {isDry ? (
            <Pressable style={buttonStyle} onPress={() => send('Toggle')}>
              <Text style={buttonTextStyle}>Schalten</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={buttonStyle} onPress={() => send('Up')}>
                <Text style={buttonTextStyle}>Hoch</Text>
              </Pressable>
              <Pressable style={buttonStyle} onPress={() => send('My')}>
                <Text style={buttonTextStyle}>{myLabel}</Text>
              </Pressable>
              <Pressable style={buttonStyle} onPress={() => send('Down')}>
                <Text style={buttonTextStyle}>Runter</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fallback: { flex: 1 },
  content: { alignItems: 'center', padding: spacing.xl },
  status: { fontFamily: font.semibold, fontSize: 18, marginBottom: spacing.xs },
  meta: { fontFamily: font.regular, fontSize: 13, marginBottom: spacing.m },
  empty: {
    textAlign: 'center',
    fontFamily: font.regular,
    marginTop: spacing.xxxl,
  },
  buttons: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.xl },
  button: {
    ...flat,
    borderRadius: radius.md,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.xl,
  },
  buttonText: type.button,
});
