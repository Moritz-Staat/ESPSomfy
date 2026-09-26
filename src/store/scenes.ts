import { Shade } from '@/models/index';

import { isPositionable } from './bulk';

export interface SceneEntry {
  shadeId: number;
  /** Zielposition 0–100 (0 = offen, 100 = geschlossen). */
  target: number;
}

export interface Scene {
  id: string;
  name: string;
  entries: SceneEntry[];
}

/** Genug für den Hausgebrauch; verhindert, dass der persistierte Zustand wuchert. */
export const MAX_SCENES = 20;

// Die Firmware kennt keine Szenen — das ist reine App-Funktionalität (#26, #40).
// Gespeichert werden Ziele, keine Befehle: Eine Szene, die „Hoch" festhält, wäre
// nach einer Umsortierung oder Umbenennung nicht mehr nachvollziehbar.

/** Fortlaufende, nach einem Neustart nicht kollidierende Kennung. */
export function newSceneId(existing: Scene[]): string {
  const used = new Set(existing.map((scene) => scene.id));
  let n = existing.length + 1;
  while (used.has(`s${n}`)) n++;
  return `s${n}`;
}

/**
 * Nimmt die aktuellen Positionen als Szene auf.
 *
 * Trockenkontakte bleiben außen vor — sie haben keine Position, die sich
 * wiederherstellen ließe.
 */
export function captureScene(name: string, shades: Shade[], existing: Scene[]): Scene {
  return {
    id: newSceneId(existing),
    name,
    entries: shades
      .filter(isPositionable)
      .map((shade) => ({ shadeId: shade.shadeId, target: shade.position })),
  };
}

/**
 * Was beim Ausführen tatsächlich gesendet wird.
 *
 * Einträge zu Rollos, die es nicht mehr gibt, fallen weg — eine Szene darf nach
 * dem Löschen eines Rollos nicht ins Leere greifen. Rollos, die schon auf ihrem
 * Ziel stehen, werden übersprungen: Das ist der halbe Funkverkehr bei einer Szene,
 * die man zweimal hintereinander auslöst.
 */
export function sceneSteps(
  scene: Scene,
  shadesById: Record<number, Shade>
): { shadeId: number; target: number; name: string }[] {
  return scene.entries.flatMap((entry) => {
    const shade = shadesById[entry.shadeId];
    if (!shade) return [];
    if (shade.position === entry.target) return [];
    return [{ shadeId: entry.shadeId, target: entry.target, name: shade.name }];
  });
}
