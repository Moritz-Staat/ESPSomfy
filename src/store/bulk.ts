import { Group, Shade, ShadeType } from '@/models/index';

/**
 * Abstand zwischen zwei Funkbefehlen einer Sammelaktion.
 *
 * NOCH ZU MESSEN (#26). Issue #26 nennt 150–200 ms, das stammt aber aus der Zeit
 * vor dem `repeats`-Befund: Beide Rollos hatten `repeats: 0`, und seit der
 * Korrektur auf 3 sendet die Firmware pro Befehl den Wake-up-Puls plus vier
 * Frames statt einem — die Luftzeit ist damit grob verdreifacht. Der
 * Sendepuffer des CC1101 ist mit `MAX_TX_BUFFER 5` klein.
 *
 * 400 ms ist deshalb absichtlich konservativ gewählt und keine gemessene Zahl.
 * Am echten Gerät heruntertasten, bis Befehle verloren gehen, und den letzten
 * verlustfreien Wert mit Messdatum hier eintragen.
 */
export const BULK_INTERVAL_MS = 400;

/** Ab dieser Anzahl betroffener Rollos wird „Alle runter" abgefragt (#26). */
export const CONFIRM_THRESHOLD = 10;

export type BulkStep =
  | { kind: 'group'; groupId: number; name: string; covers: number[] }
  | { kind: 'shade'; shadeId: number; name: string };

export interface BulkPlan {
  steps: BulkStep[];
  /** Betroffene Rollos insgesamt. */
  shadeCount: number;
  /**
   * Eingesparte Funkbefehle gegenüber „jedes Rollo einzeln". Ein Gruppenbefehl
   * erreicht alle Mitglieder mit einem einzigen Funkbefehl.
   */
  saved: number;
}

/** Trockenkontakte haben keine Fahrposition — sie sind Schalter, keine Rollos. */
export function isPositionable(shade: Shade): boolean {
  return shade.shadeType !== ShadeType.drycontact && shade.shadeType !== ShadeType.drycontact2;
}

/**
 * Verteilt eine Sammelaktion auf möglichst wenige Funkbefehle.
 *
 * Eine Gruppe wird nur dann genutzt, wenn **alle** ihre Mitglieder zur Auswahl
 * gehören. Sonst würde der Gruppenbefehl Rollos mitbewegen, die der Nutzer nicht
 * gemeint hat — bei „alle Rollos im Wohnzimmer" wäre das ein Rollo im Schlafzimmer.
 * Ebenso werden Gruppen übersprungen, deren Mitglieder eine zuvor gewählte Gruppe
 * schon abdeckt: Ein zweiter Befehl an dasselbe Rollo kostet nur Luftzeit.
 *
 * Große Gruppen zuerst (bei Gleichstand die kleinere groupId), damit das Ergebnis
 * unabhängig von der Objektreihenfolge reproduzierbar ist.
 */
export function planBulk(shades: Shade[], groups: Group[]): BulkPlan {
  const targets = shades.filter(isPositionable);
  const targetIds = new Set(targets.map((shade) => shade.shadeId));
  const covered = new Set<number>();
  const steps: BulkStep[] = [];
  let saved = 0;

  const usable = groups
    .filter((group) => group.shades.length > 1)
    .sort((a, b) => b.shades.length - a.shades.length || a.groupId - b.groupId);

  for (const group of usable) {
    const members = group.shades;
    const fullyInside = members.every((shadeId) => targetIds.has(shadeId));
    const untouched = members.every((shadeId) => !covered.has(shadeId));
    if (!fullyInside || !untouched) continue;
    steps.push({ kind: 'group', groupId: group.groupId, name: group.name, covers: [...members] });
    for (const shadeId of members) covered.add(shadeId);
    saved += members.length - 1;
  }

  for (const shade of targets) {
    if (covered.has(shade.shadeId)) continue;
    steps.push({ kind: 'shade', shadeId: shade.shadeId, name: shade.name });
  }

  return { steps, shadeCount: targets.length, saved };
}

export interface RunOptions {
  intervalMs?: number;
  /** Nach jedem Schritt aufgerufen — trägt die Fortschrittsanzeige. */
  onProgress?: (done: number, total: number) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Setzt die Schritte gestaffelt ab und liefert die gescheiterten zurück.
 *
 * Ein Fehler bricht die Reihe **nicht** ab: Wenn Rollo 3 von 12 nicht antwortet,
 * sollen die übrigen neun trotzdem fahren. Das Ergebnis sagt am Ende, wie viele
 * es nicht geschafft haben — eine Meldung je Fehler wäre bei 32 Rollos unlesbar.
 */
export async function runSteps(
  steps: BulkStep[],
  execute: (step: BulkStep) => Promise<void>,
  options: RunOptions = {}
): Promise<BulkStep[]> {
  const { intervalMs = BULK_INTERVAL_MS, onProgress } = options;
  const failed: BulkStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    // Abstand *vor* jedem Schritt außer dem ersten: Der erste Befehl soll ohne
    // Verzögerung rausgehen, damit der Tastendruck sich sofort anfühlt.
    if (i > 0 && intervalMs > 0) await wait(intervalMs);
    try {
      await execute(steps[i]);
    } catch {
      failed.push(steps[i]);
    }
    onProgress?.(i + 1, steps.length);
  }
  return failed;
}
