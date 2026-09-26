import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionBar } from '@/components/ConnectionBar';
import { NameSheet } from '@/components/NameSheet';
import { Button, ConfirmDialog, useToast } from '@/components/ui/index';
import { Shade } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { BULK_INTERVAL_MS, isPositionable } from '@/store/bulk';
import { captureScene, MAX_SCENES, Scene, sceneSteps } from '@/store/scenes';
import { selectIsOffline } from '@/store/selectors';
import { sendShadeTarget } from '@/store/service';
import { flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

type Dialog = { kind: 'add' } | { kind: 'rename'; scene: Scene } | { kind: 'delete'; scene: Scene };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function Scenes() {
  const shadesById = useAppStore((s) => s.shadesById);
  const scenes = useAppStore((s) => s.scenes);
  const upsertScene = useAppStore((s) => s.upsertScene);
  const deleteScene = useAppStore((s) => s.deleteScene);
  const offline = useAppStore(selectIsOffline);
  const { colors } = useTheme();
  const toast = useToast();

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const shades = useMemo(
    () => (Object.values(shadesById) as Shade[]).sort((a, b) => a.sortOrder - b.sortOrder),
    [shadesById]
  );
  const positionable = useMemo(() => shades.filter(isPositionable), [shades]);

  const run = async (scene: Scene) => {
    const steps = sceneSteps(scene, shadesById);
    if (steps.length === 0) {
      toast.show(`„${scene.name}" steht schon.`);
      return;
    }
    setRunning(scene.id);
    try {
      let failed = 0;
      for (let i = 0; i < steps.length; i++) {
        // Gestaffelt wie bei den Sammelaktionen — der Sendepuffer des CC1101 ist klein.
        if (i > 0) await wait(BULK_INTERVAL_MS);
        try {
          await sendShadeTarget(steps[i].shadeId, steps[i].target);
        } catch {
          failed++;
        }
        if (steps.length > 1 && i + 1 < steps.length) {
          toast.show(`${i + 1} von ${steps.length} gesendet…`);
        }
      }
      if (failed > 0) {
        toast.showError(new Error(`${failed} von ${steps.length} Befehlen nicht angekommen.`));
      } else {
        toast.show(`„${scene.name}" gestartet — ${steps.length} Rollos.`);
      }
    } finally {
      setRunning(null);
    }
  };

  const close = () => setDialog(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <Stack.Screen options={{ title: 'Szenen' }} />
      <ConnectionBar />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.body }]}>
          Eine Szene hält die aktuellen Positionen aller Rollos fest und stellt sie später
          wieder her. Szenen liegen nur auf diesem Gerät — die Steuerung selbst kennt keine.
        </Text>

        {scenes.length === 0 && (
          <Text style={[styles.empty, { color: colors.muted }]}>
            Noch keine Szene gespeichert.
          </Text>
        )}

        {scenes.map((scene) => {
          const steps = sceneSteps(scene, shadesById);
          const missing = scene.entries.length - scene.entries.filter((e) => shadesById[e.shadeId]).length;
          return (
            <View key={scene.id} style={[styles.card, { backgroundColor: colors.surfaceCard }]}>
              <Text style={[styles.name, { color: colors.ink }]}>{scene.name}</Text>
              <Text style={[styles.meta, { color: colors.body }]}>
                {scene.entries.length} {scene.entries.length === 1 ? 'Rollo' : 'Rollos'}
                {steps.length === 0 ? ' · steht schon' : ` · ${steps.length} zu fahren`}
                {missing > 0 ? ` · ${missing} nicht mehr vorhanden` : ''}
              </Text>
              <View style={styles.actions}>
                <Button
                  label="Starten"
                  compact
                  disabled={offline || running !== null}
                  busy={running === scene.id}
                  onPress={() => void run(scene)}
                />
                <Button
                  label="Umbenennen"
                  variant="secondary"
                  compact
                  onPress={() => setDialog({ kind: 'rename', scene })}
                />
                <Button
                  label="Löschen"
                  variant="danger"
                  compact
                  onPress={() => setDialog({ kind: 'delete', scene })}
                />
              </View>
            </View>
          );
        })}

        <Button
          label="Aktuelle Positionen speichern"
          block
          style={styles.add}
          disabled={scenes.length >= MAX_SCENES || positionable.length === 0}
          onPress={() => setDialog({ kind: 'add' })}
        />
        {scenes.length >= MAX_SCENES && (
          <Text style={[styles.hint, { color: colors.muted }]}>
            Mehr als {MAX_SCENES} Szenen sind nicht vorgesehen.
          </Text>
        )}
      </ScrollView>

      {dialog?.kind === 'add' && (
        <NameSheet
          title="Szene speichern"
          label="Name"
          confirmLabel="Speichern"
          hint={`Hält die Positionen von ${positionable.length} Rollos fest.`}
          onSubmit={async (name) => {
            upsertScene(captureScene(name, positionable, scenes));
          }}
          onClose={close}
        />
      )}

      {dialog?.kind === 'rename' && (
        <NameSheet
          title="Szene umbenennen"
          label="Name"
          initialValue={dialog.scene.name}
          confirmLabel="Übernehmen"
          onSubmit={async (name) => {
            upsertScene({ ...dialog.scene, name });
          }}
          onClose={close}
        />
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          visible
          title="Szene löschen?"
          message={`„${dialog.scene.name}" wird von diesem Gerät entfernt. Die Rollos bleiben, wo sie sind.`}
          onConfirm={() => {
            deleteScene(dialog.scene.id);
            close();
          }}
          onCancel={close}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.l, paddingBottom: spacing.xxxl },
  intro: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: spacing.l },
  card: {
    ...flat,
    borderRadius: radius.lg,
    padding: spacing.l,
    marginBottom: spacing.m,
  },
  name: type.shadeName,
  meta: { ...type.positionValue, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m, flexWrap: 'wrap' },
  add: { marginTop: spacing.l },
  hint: { fontFamily: font.regular, fontSize: 13, marginTop: spacing.s },
  empty: { fontFamily: font.regular, fontSize: 14, marginBottom: spacing.l },
});
