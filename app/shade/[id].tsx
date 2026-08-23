import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionBar } from '@/components/ConnectionBar';
import { FavoriteSheet } from '@/components/FavoriteSheet';
import { PositionSlider } from '@/components/PositionSlider';
import { ShadeGraphic } from '@/components/ShadeGraphic';
import { TiltControl } from '@/components/TiltControl';
import { Button } from '@/components/ui/index';
import { hasFavorite, isMoving, ShadeType, TiltType } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { sendShadeCommand, sendShadeTarget, sendTiltTarget } from '@/store/service';
import { detailStyleFor, font, spacing } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

export default function ShadeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shade = useAppStore((s) => s.shadesById[Number(id)]);
  const theme = useTheme();
  const [favoriteOpen, setFavoriteOpen] = useState(false);

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
  // Die Tilt-Felder liefert die Firmware nur, wenn das Rollo eine Lamellenachse hat.
  // tiltmotor (eigener Motor), integrated und euromode bekommen beide Achsen;
  // bei tiltonly bleibt die Lamellenachse als einzige übrig.
  const showTilt = !isDry && shade.tiltType !== TiltType.none && shade.tiltPosition !== undefined;
  // Light: die Karte „öffnet sich" zum Screen (Fläche = Kartenfarbe).
  // Dark: Canvas bleibt stehen, die Rollo-Farbe wirkt als Akzent.
  const card = detailStyleFor(theme, shade.shadeId);

  const send = (command: Parameters<typeof sendShadeCommand>[1]) => {
    sendShadeCommand(shade.shadeId, command).catch(() => {});
  };

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
        {showSlider && (
          <View style={styles.graphic}>
            <ShadeGraphic position={shade.position} on={card} />
          </View>
        )}
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
        {showTilt && hasFavorite(shade.myTiltPos) && (
          <Text style={[styles.meta, { color: card.fg }]}>
            Lamellen-Favorit: {shade.myTiltPos} %
          </Text>
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

        {showTilt && (
          <TiltControl
            value={shade.tiltPosition ?? 0}
            on={card}
            onCommit={(value) => {
              sendTiltTarget(shade.shadeId, value).catch(() => {});
            }}
          />
        )}

        <View style={styles.buttons}>
          {isDry ? (
            <Button label="Schalten" card={card} onPress={() => send('Toggle')} />
          ) : (
            <>
              {/* Bei tiltonly steuern diese Befehle die Lamellen: die Firmware
                  lenkt Up/Down/My dort intern auf das Tilt-Ziel um. */}
              <Button label="Hoch" card={card} onPress={() => send('Up')} />
              <Button
                label={myLabel}
                card={card}
                onPress={() => send('My')}
                onLongPress={() => setFavoriteOpen(true)}
              />
              <Button label="Runter" card={card} onPress={() => send('Down')} />
            </>
          )}
        </View>

        {/* Der lange Druck auf „My" öffnet denselben Dialog, ist aber unsichtbar —
            deshalb steht hier zusätzlich ein benannter Weg dorthin. */}
        {!isDry && (
          <Pressable
            style={styles.favoriteLink}
            onPress={() => setFavoriteOpen(true)}
            accessibilityRole="button"
          >
            <Text style={[styles.favoriteLinkText, { color: card.fg }]}>
              {hasFavorite(shade.myPos) || hasFavorite(shade.myTiltPos)
                ? 'Favoritenposition ändern'
                : 'Favoritenposition festlegen'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Nur im geöffneten Zustand gerendert: so startet das Blatt jedes Mal mit
          frischen Werten, ohne sie in einem Effekt nachzuziehen. */}
      {favoriteOpen && <FavoriteSheet shade={shade} onClose={() => setFavoriteOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fallback: { flex: 1 },
  content: { alignItems: 'center', padding: spacing.xl },
  graphic: { marginBottom: spacing.l },
  status: { fontFamily: font.semibold, fontSize: 18, marginBottom: spacing.xs },
  meta: { fontFamily: font.regular, fontSize: 13, marginBottom: spacing.m },
  empty: {
    textAlign: 'center',
    fontFamily: font.regular,
    marginTop: spacing.xxxl,
  },
  buttons: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.xl },
  favoriteLink: { marginTop: spacing.xl, padding: spacing.s },
  favoriteLinkText: { fontFamily: font.medium, fontSize: 15, textDecorationLine: 'underline' },
});
