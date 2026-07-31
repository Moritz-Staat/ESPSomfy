import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hasFavorite, isMoving, Shade, ShadeType, TiltType } from '@/models/index';
import { sendShadeCommand } from '@/store/service';
import { cardStyleFor, flat, font, radius, spacing, type } from '@/theme/index';

function isDryContact(shade: Shade): boolean {
  return shade.shadeType === ShadeType.drycontact || shade.shadeType === ShadeType.drycontact2;
}

export function ShadeCard({ shade }: { shade: Shade }) {
  const router = useRouter();
  const moving = isMoving(shade);
  // „My" ist doppelt belegt: während der Fahrt Stopp, im Stillstand Fahrt zum Favoriten.
  const myLabel = moving ? 'Stopp' : hasFavorite(shade.myPos) ? 'Favorit' : 'My';
  // Kartenfarbe hängt an shadeId (stabil bei Umsortierung), nicht am Listenindex.
  const card = cardStyleFor(shade.shadeId);

  const send = (command: Parameters<typeof sendShadeCommand>[1]) => {
    sendShadeCommand(shade.shadeId, command).catch(() => {});
  };

  const cardStyle = [styles.card, { backgroundColor: card.bg }];
  const buttonStyle = [styles.button, { backgroundColor: card.buttonBg }];
  const buttonTextStyle = [styles.buttonText, { color: card.buttonFg }];

  // drycontact/drycontact2 haben keine Position → als Schalter darstellen.
  if (isDryContact(shade)) {
    return (
      <View style={cardStyle}>
        <View style={styles.info}>
          <Text style={[styles.name, { color: card.fg }]}>{shade.name}</Text>
          <Text style={[styles.meta, { color: card.fg }]}>Trockenkontakt</Text>
        </View>
        <Pressable style={buttonStyle} onPress={() => send('Toggle')}>
          <Text style={buttonTextStyle}>Schalten</Text>
        </Pressable>
      </View>
    );
  }

  const showPosition = shade.tiltType !== TiltType.tiltonly;

  return (
    <Pressable
      style={cardStyle}
      onPress={() => router.push({ pathname: '/shade/[id]', params: { id: shade.shadeId } })}
    >
      <View style={styles.info}>
        <Text style={[styles.name, { color: card.fg }]}>{shade.name}</Text>
        {showPosition && (
          <Text style={[styles.meta, { color: card.fg }]}>{shade.position} %</Text>
        )}
        {moving && (
          <Text style={[styles.movingText, { color: card.fg }]}>
            {shade.direction < 0 ? 'öffnet…' : 'schließt…'}
          </Text>
        )}
        {!moving && hasFavorite(shade.myPos) && (
          <Text style={[styles.meta, { color: card.fg }]}>Favorit: {shade.myPos} %</Text>
        )}
      </View>
      <View style={styles.buttons}>
        <Pressable style={buttonStyle} onPress={() => send('Up')}>
          <Text style={buttonTextStyle}>Hoch</Text>
        </Pressable>
        <Pressable style={buttonStyle} onPress={() => send('My')}>
          <Text style={buttonTextStyle}>{myLabel}</Text>
        </Pressable>
        <Pressable style={buttonStyle} onPress={() => send('Down')}>
          <Text style={buttonTextStyle}>Runter</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...flat,
    borderRadius: radius.xl,
    padding: spacing.l,
    marginHorizontal: spacing.l,
    marginBottom: spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: { flex: 1 },
  name: type.shadeName,
  meta: { ...type.positionValue, fontSize: 13, marginTop: 2 },
  movingText: { fontFamily: font.semibold, fontSize: 13, marginTop: 2 },
  buttons: { flexDirection: 'row', gap: spacing.s },
  button: {
    ...flat,
    borderRadius: radius.md,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
  },
  buttonText: { ...type.button, fontSize: 13 },
});
