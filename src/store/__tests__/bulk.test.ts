import { Group, Shade, ShadeType } from '@/models/index';
import { BulkStep, planBulk, runSteps } from '@/store/bulk';

function shade(shadeId: number, over: Partial<Shade> = {}): Shade {
  return {
    shadeId,
    name: `Rollo ${shadeId}`,
    position: 0,
    target: 0,
    direction: 0,
    myPos: -1,
    sortOrder: shadeId,
    shadeType: ShadeType.roller,
    ...over,
  } as Shade;
}

function group(groupId: number, shades: number[], name = `Gruppe ${groupId}`): Group {
  return { groupId, name, shades, sortOrder: groupId } as Group;
}

describe('planBulk', () => {
  it('nimmt ohne Gruppen jedes Rollo einzeln', () => {
    const plan = planBulk([shade(1), shade(2), shade(3)], []);
    expect(plan.steps).toEqual([
      { kind: 'shade', shadeId: 1, name: 'Rollo 1' },
      { kind: 'shade', shadeId: 2, name: 'Rollo 2' },
      { kind: 'shade', shadeId: 3, name: 'Rollo 3' },
    ]);
    expect(plan.saved).toBe(0);
    expect(plan.shadeCount).toBe(3);
  });

  it('ersetzt Einzelbefehle durch einen Gruppenbefehl', () => {
    const plan = planBulk([shade(1), shade(2), shade(3)], [group(7, [1, 2, 3])]);
    expect(plan.steps).toEqual([
      { kind: 'group', groupId: 7, name: 'Gruppe 7', covers: [1, 2, 3] },
    ]);
    // Ein Funkbefehl statt drei.
    expect(plan.saved).toBe(2);
  });

  it('mischt Gruppe und Rest', () => {
    const plan = planBulk([shade(1), shade(2), shade(3)], [group(7, [1, 2])]);
    expect(plan.steps).toEqual([
      { kind: 'group', groupId: 7, name: 'Gruppe 7', covers: [1, 2] },
      { kind: 'shade', shadeId: 3, name: 'Rollo 3' },
    ]);
    expect(plan.saved).toBe(1);
  });

  // Der wichtigste Fall: Eine Gruppe, die über die Auswahl hinausreicht, darf nicht
  // benutzt werden — sonst bewegt „alle im Wohnzimmer" ein Rollo im Schlafzimmer.
  it('verwirft eine Gruppe, die über die Auswahl hinausgreift', () => {
    const plan = planBulk([shade(1), shade(2)], [group(7, [1, 2, 99])]);
    expect(plan.steps).toEqual([
      { kind: 'shade', shadeId: 1, name: 'Rollo 1' },
      { kind: 'shade', shadeId: 2, name: 'Rollo 2' },
    ]);
    expect(plan.saved).toBe(0);
  });

  it('nimmt die größere Gruppe und überspringt die schon abgedeckte', () => {
    const plan = planBulk(
      [shade(1), shade(2), shade(3), shade(4)],
      [group(1, [1, 2]), group(2, [1, 2, 3])]
    );
    expect(plan.steps).toEqual([
      { kind: 'group', groupId: 2, name: 'Gruppe 2', covers: [1, 2, 3] },
      { kind: 'shade', shadeId: 4, name: 'Rollo 4' },
    ]);
    expect(plan.saved).toBe(2);
  });

  it('nutzt zwei überschneidungsfreie Gruppen', () => {
    const plan = planBulk(
      [shade(1), shade(2), shade(3), shade(4)],
      [group(1, [1, 2]), group(2, [3, 4])]
    );
    expect(plan.steps.map((s) => s.kind)).toEqual(['group', 'group']);
    expect(plan.saved).toBe(2);
  });

  it('ignoriert einelementige Gruppen — sie sparen keinen Befehl', () => {
    const plan = planBulk([shade(1), shade(2)], [group(7, [1])]);
    expect(plan.steps).toEqual([
      { kind: 'shade', shadeId: 1, name: 'Rollo 1' },
      { kind: 'shade', shadeId: 2, name: 'Rollo 2' },
    ]);
  });

  it('lässt Trockenkontakte aus — sie haben keine Fahrposition', () => {
    const plan = planBulk(
      [shade(1), shade(2, { shadeType: ShadeType.drycontact }), shade(3)],
      []
    );
    expect(plan.steps.map((s) => s.kind === 'shade' && s.shadeId)).toEqual([1, 3]);
    expect(plan.shadeCount).toBe(2);
  });

  it('ist unabhängig von der Reihenfolge der Gruppen', () => {
    const shades = [shade(1), shade(2), shade(3), shade(4)];
    const a = planBulk(shades, [group(1, [1, 2]), group(2, [3, 4])]);
    const b = planBulk(shades, [group(2, [3, 4]), group(1, [1, 2])]);
    expect(a.steps).toEqual(b.steps);
  });
});

describe('runSteps', () => {
  const steps: BulkStep[] = [
    { kind: 'shade', shadeId: 1, name: 'Rollo 1' },
    { kind: 'shade', shadeId: 2, name: 'Rollo 2' },
    { kind: 'shade', shadeId: 3, name: 'Rollo 3' },
  ];

  it('setzt alle Schritte in Reihe ab', async () => {
    const seen: number[] = [];
    const failed = await runSteps(
      steps,
      async (step) => {
        if (step.kind === 'shade') seen.push(step.shadeId);
      },
      { intervalMs: 0 }
    );
    expect(seen).toEqual([1, 2, 3]);
    expect(failed).toEqual([]);
  });

  it('läuft nach einem Fehler weiter und meldet ihn am Ende', async () => {
    const seen: number[] = [];
    const failed = await runSteps(
      steps,
      async (step) => {
        if (step.kind !== 'shade') return;
        if (step.shadeId === 2) throw new Error('kein Funk');
        seen.push(step.shadeId);
      },
      { intervalMs: 0 }
    );
    expect(seen).toEqual([1, 3]);
    expect(failed).toEqual([{ kind: 'shade', shadeId: 2, name: 'Rollo 2' }]);
  });

  it('zählt den Fortschritt einschließlich der Fehlschläge', async () => {
    const progress: string[] = [];
    await runSteps(
      steps,
      async (step) => {
        if (step.kind === 'shade' && step.shadeId === 1) throw new Error('kein Funk');
      },
      { intervalMs: 0, onProgress: (done, total) => progress.push(`${done}/${total}`) }
    );
    expect(progress).toEqual(['1/3', '2/3', '3/3']);
  });

  it('staffelt die Befehle, aber nicht vor dem ersten', async () => {
    jest.useFakeTimers();
    try {
      const seen: number[] = [];
      const running = runSteps(
        steps,
        async (step) => {
          if (step.kind === 'shade') seen.push(step.shadeId);
        },
        { intervalMs: 400 }
      );
      // Der erste Befehl geht ohne Verzögerung raus.
      await Promise.resolve();
      expect(seen).toEqual([1]);

      await jest.advanceTimersByTimeAsync(400);
      expect(seen).toEqual([1, 2]);

      await jest.advanceTimersByTimeAsync(400);
      expect(seen).toEqual([1, 2, 3]);
      await running;
    } finally {
      jest.useRealTimers();
    }
  });
});
