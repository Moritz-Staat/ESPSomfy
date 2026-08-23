import { useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { ShadeCard } from '@/components/ShadeCard';
import { Button } from '@/components/ui/index';
import { SomfyCommand } from '@/models/index';
import { GroupSummary } from '@/store/selectors';
import { sendGroupCommand } from '@/store/service';
import { flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

// Auf Android muss die Layout-Animation einmalig freigeschaltet werden.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Wie lange „Befehl gesendet" stehen bleibt, bevor wieder der abgeleitete
// Zustand erscheint. Lang genug, um die Rückmeldung zu lesen, kurz genug,
// dass die ersten shadeState-Events sie ablösen.
const SENT_NOTICE_MS = 2500;

export function GroupCard({ summary }: { summary: GroupSummary }) {
  const { group, members, position, moving } = summary;
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [sent, setSent] = useState(false);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (sentTimer.current) clearTimeout(sentTimer.current);
  }, []);

  const send = (command: SomfyCommand) => {
    sendGroupCommand(group.groupId, command).catch(() => {});
    setSent(true);
    if (sentTimer.current) clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => setSent(false), SENT_NOTICE_MS);
  };

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((open) => !open);
  };

  // Ein Gruppenbefehl liefert keine Gruppenposition zurück; bis die Mitglieder
  // einzeln melden, wird deshalb nur gesagt, dass der Befehl raus ist.
  const state = sent
    ? 'Befehl gesendet'
    : moving
      ? 'fährt…'
      : position === null
        ? 'gemischt'
        : `${position} %`;

  const memberCount = `${members.length} ${members.length === 1 ? 'Rollo' : 'Rollos'}`;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.surfaceCard }]}>
      <View style={styles.head}>
        <Pressable style={styles.info} onPress={toggle} accessibilityRole="button">
          <Text style={[styles.name, { color: colors.ink }]}>{group.name}</Text>
          <Text style={[styles.meta, { color: colors.body }]}>
            {memberCount} · {state}
          </Text>
        </Pressable>
        <View style={styles.buttons}>
          <Button label="Hoch" compact onPress={() => send('Up')} />
          <Button label="My" compact onPress={() => send('My')} />
          <Button label="Runter" compact onPress={() => send('Down')} />
        </View>
      </View>

      <Pressable onPress={toggle} accessibilityRole="button" style={styles.toggle}>
        <Text style={[styles.toggleText, { color: colors.muted }]}>
          {expanded ? 'Mitglieder ausblenden' : 'Mitglieder anzeigen'}
        </Text>
      </Pressable>

      {/* Jedes Mitglied bleibt einzeln steuerbar — dieselbe Karte wie im Dashboard. */}
      {expanded &&
        (members.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>
            Dieser Gruppe ist kein Rollo zugeordnet.
          </Text>
        ) : (
          <View style={styles.members}>
            {members.map((shade) => (
              <ShadeCard key={shade.shadeId} shade={shade} />
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...flat,
    borderRadius: radius.xl,
    marginHorizontal: spacing.l,
    marginBottom: spacing.m,
    paddingVertical: spacing.l,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
  },
  info: { flex: 1 },
  name: type.shadeName,
  meta: { ...type.positionValue, fontSize: 13, marginTop: 2 },
  buttons: { flexDirection: 'row', gap: spacing.s },
  toggle: { paddingHorizontal: spacing.l, paddingTop: spacing.m },
  toggleText: { ...type.label, fontSize: 11 },
  members: { marginTop: spacing.m, marginHorizontal: -spacing.l },
  empty: {
    fontFamily: font.regular,
    fontSize: 14,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
  },
});
