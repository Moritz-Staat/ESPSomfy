import { Shade, ShadeType } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import { captureScene, MAX_SCENES, newSceneId, Scene, sceneSteps } from '@/store/scenes';

function shade(shadeId: number, position: number, over: Partial<Shade> = {}): Shade {
  return {
    shadeId,
    name: `Rollo ${shadeId}`,
    position,
    target: position,
    direction: 0,
    myPos: -1,
    sortOrder: shadeId,
    shadeType: ShadeType.roller,
    ...over,
  } as Shade;
}

const byId = (shades: Shade[]) =>
  Object.fromEntries(shades.map((s) => [s.shadeId, s])) as Record<number, Shade>;

describe('newSceneId', () => {
  it('beginnt bei s1', () => {
    expect(newSceneId([])).toBe('s1');
  });

  it('weicht einer vergebenen Kennung aus', () => {
    const existing = [{ id: 's1', name: 'a', entries: [] }] as Scene[];
    expect(newSceneId(existing)).toBe('s2');
  });

  // Nach dem Loeschen der ersten Szene ist s2 belegt, s2 waere aber der naechste
  // Kandidat — die Kennung muss trotzdem frei sein.
  it('kollidiert nicht nach einem Loeschvorgang', () => {
    const existing = [{ id: 's2', name: 'b', entries: [] }] as Scene[];
    const id = newSceneId(existing);
    expect(id).not.toBe('s2');
    expect(existing.some((s) => s.id === id)).toBe(false);
  });
});

describe('captureScene', () => {
  it('haelt die aktuellen Positionen fest', () => {
    const scene = captureScene('Abend', [shade(1, 100), shade(2, 40)], []);
    expect(scene.name).toBe('Abend');
    expect(scene.entries).toEqual([
      { shadeId: 1, target: 100 },
      { shadeId: 2, target: 40 },
    ]);
  });

  it('laesst Trockenkontakte aus', () => {
    const scene = captureScene(
      'Abend',
      [shade(1, 100), shade(2, 0, { shadeType: ShadeType.drycontact2 })],
      []
    );
    expect(scene.entries).toEqual([{ shadeId: 1, target: 100 }]);
  });
});

describe('sceneSteps', () => {
  const scene: Scene = {
    id: 's1',
    name: 'Abend',
    entries: [
      { shadeId: 1, target: 100 },
      { shadeId: 2, target: 50 },
    ],
  };

  it('sendet nur, was nicht schon auf dem Ziel steht', () => {
    const steps = sceneSteps(scene, byId([shade(1, 0), shade(2, 50)]));
    expect(steps).toEqual([{ shadeId: 1, target: 100, name: 'Rollo 1' }]);
  });

  it('ueberspringt geloeschte Rollos statt ins Leere zu greifen', () => {
    const steps = sceneSteps(scene, byId([shade(2, 0)]));
    expect(steps).toEqual([{ shadeId: 2, target: 50, name: 'Rollo 2' }]);
  });

  it('ergibt nichts, wenn die Szene schon steht', () => {
    expect(sceneSteps(scene, byId([shade(1, 100), shade(2, 50)]))).toEqual([]);
  });
});

describe('Szenen im Store', () => {
  beforeEach(() => {
    useAppStore.setState({ scenes: [] });
  });

  const scene = (id: string, name = id): Scene => ({ id, name, entries: [] });

  it('legt an und ersetzt nach id', () => {
    const store = useAppStore.getState();
    store.upsertScene(scene('s1', 'Abend'));
    store.upsertScene(scene('s2', 'Morgen'));
    expect(useAppStore.getState().scenes.map((s) => s.name)).toEqual(['Abend', 'Morgen']);

    // Umbenennen laeuft ueber dieselbe Aktion und darf die Reihenfolge nicht aendern.
    store.upsertScene(scene('s1', 'Spaeter Abend'));
    expect(useAppStore.getState().scenes.map((s) => s.name)).toEqual(['Spaeter Abend', 'Morgen']);
  });

  it('loescht nach id', () => {
    const store = useAppStore.getState();
    store.upsertScene(scene('s1'));
    store.upsertScene(scene('s2'));
    store.deleteScene('s1');
    expect(useAppStore.getState().scenes.map((s) => s.id)).toEqual(['s2']);
  });

  it('nimmt ueber MAX_SCENES hinaus keine neue an, ersetzt aber weiter', () => {
    const full = Array.from({ length: MAX_SCENES }, (_, i) => scene(`s${i + 1}`));
    useAppStore.setState({ scenes: full });
    const store = useAppStore.getState();

    store.upsertScene(scene('neu'));
    expect(useAppStore.getState().scenes).toHaveLength(MAX_SCENES);

    store.upsertScene(scene('s1', 'geaendert'));
    expect(useAppStore.getState().scenes).toHaveLength(MAX_SCENES);
    expect(useAppStore.getState().scenes[0].name).toBe('geaendert');
  });
});
