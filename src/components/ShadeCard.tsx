import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hasFavorite, isMoving, Shade, ShadeType, TiltType } from '@/models/index';
import { sendShadeCommand } from '@/store/service';
import { colors, spacing } from '@/theme/index';

function isDryContact(shade: Shade): boolean {
  return shade.shadeType === ShadeType.drycontact || shade.shadeType === ShadeType.drycontact2;
}

export function ShadeCard({ shade }: { shade: Shade }) {
  const router = useRouter();
  const moving = isMoving(shade);
  // „My" ist doppelt belegt: während der Fahrt Stopp, im Stillstand Fahrt zum Favoriten.
  const myLabel = moving ? 'Stopp' : hasFavorite(shade.myPos) ? 'Favorit' : 'My';

  const send = (command: Parameters<typeof sendShadeCommand>[1]) => {
    sendShadeCommand(shade.shadeId, command).catch(() => {});
  };

  // drycontact/drycontact2 haben keine Position → als Schalter darstellen.
  if (isDryContact(shade)) {
    return (
      <View style={styles.card}>
        <View style={styles.info}>
          <Text style={styles.name}>{shade.name}</Text>
          <Text style={styles.meta}>Trockenkontakt</Text>
        </View>
        <Pressable style={styles.button} onPress={() => send('Toggle')}>
          <Text style={styles.buttonText}>Schalten</Text>
        </Pressable>
      </View>
    );
  }

  const showPosition = shade.tiltType !== TiltType.tiltonly;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/shade/[id]', params: { id: shade.shadeId } })}
    >
      <View style={styles.info}>
        <Text style={styles.name}>{shade.name}</Text>
        {showPosition && <Text style={styles.meta}>{shade.position} %</Text>}
        {moving && (
          <Text style={styles.movingText}>{shade.direction < 0 ? 'öffnet…' : 'schließt…'}</Text>
        )}
        {!moving && hasFavorite(shade.myPos) && (
          <Text style={styles.meta}>Favorit: {shade.myPos} %</Text>
        )}
      </View>
      <View style={styles.buttons}>
        <Pressable style={styles.button} onPress={() => send('Up')}>
          <Text style={styles.buttonText}>Hoch</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => send('My')}>
          <Text style={styles.buttonText}>{myLabel}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => send('Down')}>
          <Text style={styles.buttonText}>Runter</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: spacing.l,
    marginHorizontal: spacing.l,
    marginVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  movingText: { fontSize: 13, color: colors.moving, marginTop: 2, fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: spacing.s },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
