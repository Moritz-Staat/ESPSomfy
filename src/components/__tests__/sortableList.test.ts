import { mergeOrder, swapAt, type SortableEntry } from '@/components/SortableList';
import { compareGroups } from '@/store/selectors';
import { Group } from '@/models/index';

const entry = (id: number): SortableEntry => ({ id, label: `Eintrag ${id}` });

describe('swapAt', () => {
  test('tauscht mit dem Nachbarn', () => {
    expect(swapAt([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(swapAt([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
  });

  test('gibt am Rand dieselbe Liste zurück', () => {
    const ids = [1, 2, 3];
    // Identität, nicht nur Gleichheit: Die Ansicht darf daran erkennen, dass nichts
    // passiert ist, und keinen Schreibvorgang auslösen.
    expect(swapAt(ids, 0, -1)).toBe(ids);
    expect(swapAt(ids, 2, 1)).toBe(ids);
  });
});

describe('mergeOrder', () => {
  test('behält die gemerkte Reihenfolge', () => {
    expect(mergeOrder([3, 1, 2], [entry(1), entry(2), entry(3)])).toEqual([3, 1, 2]);
  });

  test('hängt neu dazugekommene Einträge hinten an', () => {
    expect(mergeOrder([3, 1], [entry(1), entry(2), entry(3)])).toEqual([3, 1, 2]);
  });

  test('lässt gelöschte Einträge fallen', () => {
    // Sonst ginge eine tote Id an /shadeSortOrder — die Firmware vergibt dann
    // sortOrder für einen Eintrag, den es nicht mehr gibt.
    expect(mergeOrder([3, 1, 2], [entry(1), entry(3)])).toEqual([3, 1]);
  });

  test('bleibt ohne gemerkte Reihenfolge beim Bestand', () => {
    expect(mergeOrder([], [entry(2), entry(1)])).toEqual([2, 1]);
  });
});

describe('compareGroups', () => {
  const group = (groupId: number, sortOrder?: number): Group => ({
    groupId,
    remoteAddress: 580000 + groupId,
    name: `Gruppe ${groupId}`,
    sunSensor: false,
    shades: [],
    flags: 0,
    sortOrder,
  });

  test('sortiert nach sortOrder', () => {
    const sorted = [group(1, 2), group(2, 0), group(3, 1)].sort(compareGroups);
    expect(sorted.map((g) => g.groupId)).toEqual([2, 3, 1]);
  });

  test('fällt ohne sortOrder auf die groupId zurück', () => {
    const sorted = [group(3), group(1), group(2)].sort(compareGroups);
    expect(sorted.map((g) => g.groupId)).toEqual([1, 2, 3]);
  });
});
