import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ConfirmDialog, useToast } from '@/components/ui/index';
import { Group, isMoving, Shade } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { BulkStep, CONFIRM_THRESHOLD, planBulk, runSteps } from '@/store/bulk';
import { selectIsOffline } from '@/store/selectors';
import { sendGroupCommand, sendShadeCommand } from '@/store/service';
import { spacing } from '@/theme/index';

type BulkCommand = 'Up' | 'Stop' | 'Down';

interface Props {
  /** Die Rollos, die diese Aktion betrifft — alle, oder die eines Raums. */
  shades: Shade[];
  /** Für die Rückfrage: „12 Rollos in Wohnzimmer fahren nach unten." */
  scopeLabel: string;
}

const LABELS: Record<BulkCommand, string> = {
  Up: 'Alle hoch',
  Stop: 'Alle stopp',
  Down: 'Alle runter',
};

// Sammelaktionen für eine Menge Rollos. „Alles zu" am Abend ist der häufigste
// Anwendungsfall und darf nicht zwölf Tastendrücke kosten (#26).
export function BulkActions({ shades, scopeLabel }: Props) {
  const groupsById = useAppStore((s) => s.groupsById);
  const offline = useAppStore(selectIsOffline);
  const toast = useToast();
  const [running, setRunning] = useState<BulkCommand | null>(null);
  const [pending, setPending] = useState<{ count: number } | null>(null);

  const run = async (command: BulkCommand) => {
    // „Alle stopp" darf nur fahrende Rollos treffen. Auf der Funkstrecke wird Stop
    // zum My-Befehl umgeschrieben (`Somfy.cpp:291`), und My heißt für einen Motor im
    // Stillstand „fahre zur Favoritenposition" — ein Stopp, der stehende Rollos in
    // Bewegung setzt, wäre das Gegenteil dessen, was der Knopf verspricht.
    const targets = command === 'Stop' ? shades.filter(isMoving) : shades;
    if (command === 'Stop' && targets.length === 0) {
      toast.show('Kein Rollo fährt gerade.');
      return;
    }

    const plan = planBulk(targets, Object.values(groupsById) as Group[]);
    if (plan.steps.length === 0) {
      toast.show('Kein Rollo mit Fahrposition dabei.');
      return;
    }

    // Der Befehl steckt in der Closure dieses Durchlaufs; parallele Durchläufe
    // verhindert `running`.
    const execute = (step: BulkStep): Promise<void> =>
      step.kind === 'group'
        ? sendGroupCommand(step.groupId, command)
        : sendShadeCommand(step.shadeId, command);

    setRunning(command);
    try {
      const failed = await runSteps(plan.steps, execute, {
        onProgress: (done, total) => {
          // Bei einem einzigen Befehl wäre die Anzeige nur Lärm, und die
          // Schlussmeldung soll die letzte Zwischenmeldung nicht überschreiben.
          if (total > 1 && done < total) toast.show(`${done} von ${total} gesendet…`);
        },
      });
      if (failed.length > 0) {
        toast.showError(
          new Error(`${failed.length} von ${plan.steps.length} Befehlen nicht angekommen.`)
        );
      } else {
        const rollos = `${plan.shadeCount} ${plan.shadeCount === 1 ? 'Rollo' : 'Rollos'}`;
        // Die Zahl der Befehle nur nennen, wenn Gruppen wirklich etwas gespart haben.
        const over =
          plan.saved > 0
            ? ` über ${plan.steps.length} ${plan.steps.length === 1 ? 'Befehl' : 'Befehle'}`
            : '';
        toast.show(`${rollos}${over} — Befehl raus.`);
      }
    } finally {
      setRunning(null);
    }
  };

  const press = (command: BulkCommand) => {
    if (command === 'Down') {
      const { shadeCount } = planBulk(shades, Object.values(groupsById) as Group[]);
      if (shadeCount > CONFIRM_THRESHOLD) {
        setPending({ count: shadeCount });
        return;
      }
    }
    void run(command);
  };

  return (
    <View style={styles.row}>
      {(Object.keys(LABELS) as BulkCommand[]).map((command) => (
        <Button
          key={command}
          label={LABELS[command]}
          variant="secondary"
          compact
          disabled={offline || running !== null}
          busy={running === command}
          onPress={() => press(command)}
        />
      ))}

      {pending && (
        <ConfirmDialog
          visible
          title="Alle schließen?"
          message={`${pending.count} Rollos in ${scopeLabel} fahren nach unten.`}
          confirmLabel="Schließen"
          destructive={false}
          onConfirm={() => {
            setPending(null);
            void run('Down');
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.s,
    marginHorizontal: spacing.l,
    marginBottom: spacing.m,
  },
});
