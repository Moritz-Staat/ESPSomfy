import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/index';
import { flat, font, radius, spacing, type } from '@/theme/index';
import { useTheme } from '@/theme/ThemeContext';

// Erst 800 ms nach dem letzten Verschieben senden. Wer drei Einträge hintereinander
// schiebt, löst sonst drei Schreibvorgänge auf dem ESP32 aus.
export const SORT_DEBOUNCE_MS = 800;

export interface SortableEntry {
  id: number;
  label: string;
  hint?: string;
}

// Die gemerkte Reihenfolge mit dem aktuellen Bestand abgleichen: Einträge, die
// zwischenzeitlich dazugekommen sind (neues Rollo, neuer Raum), hinten anhängen,
// gelöschte fallen raus. Sonst würde ein Socket-Event während des Sortierens den
// neuen Eintrag verschlucken oder eine tote Id an das Gerät zurückschicken.
export function mergeOrder(order: number[], entries: SortableEntry[]): number[] {
  const known = new Set(entries.map((entry) => entry.id));
  const kept = order.filter((id) => known.has(id));
  const seen = new Set(kept);
  return [...kept, ...entries.filter((entry) => !seen.has(entry.id)).map((entry) => entry.id)];
}

/** Tauscht den Eintrag an `index` mit seinem Nachbarn; am Rand bleibt die Liste unverändert. */
export function swapAt(ids: number[], index: number, delta: number): number[] {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

interface Props {
  entries: SortableEntry[];
  /** Bekommt die vollständige neue Reihenfolge als Id-Liste. */
  onCommit: (ids: number[]) => Promise<void>;
  onError: (error: unknown) => void;
  emptyText: string;
}

// Umsortieren über Schaltflächen statt über eine Ziehgeste: Das kommt ohne
// zusätzliche Abhängigkeiten aus, funktioniert mit Screenreader und Tastatur,
// und bei höchstens 32 Einträgen ist der Weg kurz genug.
export function SortableList({ entries, onCommit, onError, emptyText }: Props) {
  const { colors } = useTheme();
  // Lokale Reihenfolge, damit das Verschieben sofort sichtbar ist. Beim Fehlschlag
  // wird sie auf den zuletzt bestätigten Stand zurückgesetzt.
  const [order, setOrder] = useState<number[]>(() => entries.map((entry) => entry.id));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmed = useRef<number[]>(entries.map((entry) => entry.id));

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const visible = mergeOrder(order, entries);

  const move = (index: number, delta: number) => {
    const next = swapAt(visible, index, delta);
    if (next === visible) return;
    setOrder(next);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const previous = confirmed.current;
      onCommit(next)
        .then(() => {
          confirmed.current = next;
        })
        .catch((err) => {
          // Die Reihenfolge steht nur im Gerät — schlägt das Schreiben fehl,
          // muss die Ansicht zurück auf den Stand, den das Gerät kennt.
          setOrder(previous);
          onError(err);
        });
    }, SORT_DEBOUNCE_MS);
  };

  if (visible.length === 0) {
    return <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>;
  }

  return (
    <View>
      {visible.map((id, index) => {
        const entry = byId.get(id);
        if (!entry) return null;
        return (
          <View key={id} style={[styles.row, { backgroundColor: colors.surfaceCard }]}>
            <Text style={[styles.position, { color: colors.body }]}>{index + 1}</Text>
            <View style={styles.info}>
              <Text style={[styles.label, { color: colors.ink }]}>{entry.label}</Text>
              {entry.hint && (
                <Text style={[styles.hint, { color: colors.body }]}>{entry.hint}</Text>
              )}
            </View>
            <View style={styles.actions}>
              <Button
                label="↑"
                variant="secondary"
                compact
                onPress={() => move(index, -1)}
                disabled={index === 0}
              />
              <Button
                label="↓"
                variant="secondary"
                compact
                onPress={() => move(index, 1)}
                disabled={index === visible.length - 1}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: font.regular, fontSize: 14, marginBottom: spacing.m },
  row: {
    ...flat,
    borderRadius: radius.md,
    padding: spacing.m,
    marginBottom: spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
  },
  position: { ...type.positionValue, fontSize: 13, width: 24 },
  info: { flex: 1 },
  label: { fontFamily: font.medium, fontSize: 16 },
  hint: { fontFamily: font.regular, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.s },
});
