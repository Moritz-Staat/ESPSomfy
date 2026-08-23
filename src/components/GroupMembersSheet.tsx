import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, ErrorNotice, OptionList, Sheet } from '@/components/ui/index';
import { Group, LIMITS, Shade } from '@/models/index';
import { linkShadeToGroup, unlinkShadeFromGroup } from '@/store/management';
import { font, spacing } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  group: Group;
  shades: Shade[];
  onClose: () => void;
}

// Mitglieder einer Gruppe. Die Firmware kennt nur „einzeln verknüpfen" und
// „einzeln lösen" — die Auswahl wird deshalb beim Speichern in die Differenz
// zum vorherigen Stand übersetzt.
export function GroupMembersSheet({ group, shades, onClose }: Props) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number[]>(group.shades);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const toggle = (shadeId: number) => {
    setSelected((prev) =>
      prev.includes(shadeId) ? prev.filter((id) => id !== shadeId) : [...prev, shadeId]
    );
  };

  const tooMany = selected.length > LIMITS.maxGroupedShades;

  const submit = async () => {
    if (tooMany) return;
    setBusy(true);
    setError(null);
    try {
      const added = selected.filter((id) => !group.shades.includes(id));
      const removed = group.shades.filter((id) => !selected.includes(id));
      // Nacheinander, nicht parallel: der ESP32 verträgt keine Anfrageflut, und
      // jede Antwort trägt bereits den neuen Gruppenstand.
      for (const shadeId of added) await linkShadeToGroup(shadeId, group.groupId);
      for (const shadeId of removed) await unlinkShadeFromGroup(shadeId, group.groupId);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const options = shades.map((shade) => ({
    value: shade.shadeId,
    label: shade.name,
    // Ein Rollo darf in mehreren Gruppen sein; der Hinweis erklärt nur, warum
    // es sich anderswo nicht löschen lässt.
    hint: shade.inGroup && !group.shades.includes(shade.shadeId) ? 'in einer anderen Gruppe' : undefined,
  }));

  return (
    <Sheet
      visible
      title={`Mitglieder: ${group.name}`}
      onClose={onClose}
      footer={
        <>
          <Button
            label="Abbrechen"
            variant="secondary"
            onPress={onClose}
            disabled={busy}
            style={styles.footerButton}
          />
          <Button
            label="Speichern"
            onPress={submit}
            busy={busy}
            disabled={tooMany}
            style={styles.footerButton}
          />
        </>
      }
    >
      <ErrorNotice error={error} />
      <Text style={[styles.hint, { color: colors.body }]}>
        Die Zuordnung geschieht im Gerät. Damit ein Gruppenbefehl einen Motor tatsächlich
        erreicht, muss dieser die Funkadresse der Gruppe zuvor gelernt haben — das geschieht
        über den Prog-Vorgang am Motor, nicht hier.
      </Text>
      <OptionList
        options={options}
        selected={selected}
        onSelect={toggle}
        multiple
        emptyText="Es sind keine Rollos angelegt."
      />
      {tooMany && (
        <Text style={[styles.warning, { color: colors.errorText }]}>
          Höchstens {LIMITS.maxGroupedShades} Rollos je Gruppe.
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: spacing.l },
  warning: { fontFamily: font.regular, fontSize: 14, marginTop: spacing.s },
  footerButton: { flex: 1 },
});
