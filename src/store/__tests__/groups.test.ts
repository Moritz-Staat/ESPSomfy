import { Group, Shade, ShadeType, TiltType } from '@/models/index';
import { selectGroupSummaries } from '@/store/selectors';

function makeShade(shadeId: number, position: number, direction = 0): Shade {
  return {
    shadeId,
    shadeType: ShadeType.roller,
    remoteAddress: 571000 + shadeId,
    name: `Rollo ${shadeId}`,
    direction,
    position,
    target: position,
    myPos: -1,
    tiltType: TiltType.none,
    flipCommands: false,
    flipPosition: false,
    flags: 0,
    sunSensor: false,
    light: false,
    sortOrder: shadeId,
  };
}

function makeGroup(groupId: number, shades: number[]): Group {
  return { groupId, remoteAddress: 580000 + groupId, name: `Gruppe ${groupId}`, sunSensor: false, shades, flags: 0 };
}

function state(groups: Group[], shades: Shade[]) {
  return {
    groupsById: Object.fromEntries(groups.map((g) => [g.groupId, g])),
    shadesById: Object.fromEntries(shades.map((s) => [s.shadeId, s])),
  };
}

describe('selectGroupSummaries', () => {
  test('stehen alle Mitglieder gleich, wird die gemeinsame Position gezeigt', () => {
    const [summary] = selectGroupSummaries(
      state([makeGroup(1, [1, 2])], [makeShade(1, 40), makeShade(2, 40)])
    );
    expect(summary.position).toBe(40);
    expect(summary.moving).toBe(false);
    expect(summary.members).toHaveLength(2);
  });

  // Eine gemittelte Zahl würde eine Position behaupten, auf der kein Rollo steht.
  test('bei uneinheitlichem Stand bleibt die Position offen', () => {
    const [summary] = selectGroupSummaries(
      state([makeGroup(1, [1, 2])], [makeShade(1, 0), makeShade(2, 100)])
    );
    expect(summary.position).toBeNull();
  });

  test('ein fahrendes Mitglied genügt für den Fahrzustand', () => {
    const [summary] = selectGroupSummaries(
      state([makeGroup(1, [1, 2])], [makeShade(1, 40), makeShade(2, 40, 1)])
    );
    expect(summary.moving).toBe(true);
  });

  // Nach dem Löschen eines Rollos kann eine Gruppe noch dessen Id tragen, bis das
  // nächste groupState-Event eintrifft.
  test('unbekannte Mitglieds-Ids werden übersprungen', () => {
    const [summary] = selectGroupSummaries(state([makeGroup(1, [1, 99])], [makeShade(1, 40)]));
    expect(summary.members.map((s) => s.shadeId)).toEqual([1]);
    expect(summary.position).toBe(40);
  });

  test('eine leere Gruppe hat keine Position', () => {
    const [summary] = selectGroupSummaries(state([makeGroup(1, [])], []));
    expect(summary.members).toHaveLength(0);
    expect(summary.position).toBeNull();
  });

  test('Mitglieder folgen der sortOrder', () => {
    const a = { ...makeShade(1, 0), sortOrder: 5 };
    const b = { ...makeShade(2, 0), sortOrder: 1 };
    const [summary] = selectGroupSummaries(state([makeGroup(1, [1, 2])], [a, b]));
    expect(summary.members.map((s) => s.shadeId)).toEqual([2, 1]);
  });
});
