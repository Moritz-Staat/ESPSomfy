import { Shade, ShadeType, TiltType } from '@/models/index';
import { OPTIMISTIC_ROLLBACK_MS, useAppStore } from '@/store/appStore';
import { predictCommandEffect, predictTiltEffect } from '@/store/service';

function makeShade(overrides: Partial<Shade> & { shadeId: number }): Shade {
  return {
    shadeType: ShadeType.blind,
    remoteAddress: 571000 + overrides.shadeId,
    name: `Jalousie ${overrides.shadeId}`,
    direction: 0,
    position: 40,
    target: 40,
    myPos: -1,
    tiltType: TiltType.integrated,
    flipCommands: false,
    flipPosition: false,
    flags: 0,
    sunSensor: false,
    light: false,
    sortOrder: 0,
    tiltDirection: 0,
    tiltPosition: 30,
    tiltTarget: 30,
    myTiltPos: -1,
    ...overrides,
  };
}

describe('predictTiltEffect', () => {
  test('Hoch und Runter zielen auf die Endlagen der Lamellenachse', () => {
    const shade = makeShade({ shadeId: 1 });
    expect(predictTiltEffect(shade, 'Up')).toEqual({ tiltDirection: -1, tiltTarget: 0 });
    expect(predictTiltEffect(shade, 'Down')).toEqual({ tiltDirection: 1, tiltTarget: 100 });
  });

  test('My stoppt, solange die Lamellen fahren', () => {
    const shade = makeShade({ shadeId: 1, tiltDirection: 1 });
    expect(predictTiltEffect(shade, 'My')).toEqual({ tiltDirection: 0 });
  });

  test('My fährt im Stillstand zum Lamellen-Favoriten', () => {
    const shade = makeShade({ shadeId: 1, tiltPosition: 20, myTiltPos: 70 });
    expect(predictTiltEffect(shade, 'My')).toEqual({ tiltDirection: 1, tiltTarget: 70 });
  });

  // myTiltPos ist -1, wenn kein Favorit gesetzt ist (nicht 255, siehe api-notes).
  test('My bewirkt nichts, wenn kein Lamellen-Favorit gesetzt ist', () => {
    expect(predictTiltEffect(makeShade({ shadeId: 1, myTiltPos: -1 }), 'My')).toEqual({});
  });
});

describe('predictCommandEffect bei tiltonly', () => {
  // Die Firmware lenkt Up/Down/My bei tiltonly intern auf das Tilt-Ziel um
  // (Somfy.cpp, sendCommand) — es gibt dort keine Fahrposition.
  test('lenkt auf die Lamellenachse um', () => {
    const shade = makeShade({ shadeId: 1, tiltType: TiltType.tiltonly });
    expect(predictCommandEffect(shade, 'Down')).toEqual({ tiltDirection: 1, tiltTarget: 100 });
  });

  test('greift nicht bei Rollos mit Fahrposition', () => {
    const shade = makeShade({ shadeId: 1, tiltType: TiltType.integrated });
    expect(predictCommandEffect(shade, 'Down')).toEqual({ direction: 1, target: 100 });
  });
});

describe('Optimistic Update über beide Achsen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAppStore.setState({ shadesById: { 1: makeShade({ shadeId: 1 }) } });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('rollt nur die vorweggenommenen Felder zurück', () => {
    const store = useAppStore.getState();
    store.applyOptimistic(1, { tiltTarget: 90, tiltDirection: 1 });
    expect(useAppStore.getState().shadesById[1].tiltTarget).toBe(90);

    jest.advanceTimersByTime(OPTIMISTIC_ROLLBACK_MS);
    const after = useAppStore.getState().shadesById[1];
    expect(after.tiltTarget).toBe(30);
    expect(after.tiltDirection).toBe(0);
    // Die Fahrachse war nie Teil der Vorwegnahme und bleibt unangetastet.
    expect(after.position).toBe(40);
    expect(after.target).toBe(40);
  });

  test('der Schnappschuss trägt den Stand vor der ganzen Sequenz', () => {
    const store = useAppStore.getState();
    store.applyOptimistic(1, { tiltTarget: 90 });
    store.applyOptimistic(1, { tiltTarget: 10 });
    jest.advanceTimersByTime(OPTIMISTIC_ROLLBACK_MS);
    expect(useAppStore.getState().shadesById[1].tiltTarget).toBe(30);
  });

  test('eine Bestätigung vom Gerät räumt den Rollback ab', () => {
    const store = useAppStore.getState();
    store.applyOptimistic(1, { tiltTarget: 90, tiltDirection: 1 });
    store.applyShadeState({ shadeId: 1, tiltPosition: 90, tiltTarget: 90, tiltDirection: 0 });
    jest.advanceTimersByTime(OPTIMISTIC_ROLLBACK_MS);
    expect(useAppStore.getState().shadesById[1].tiltTarget).toBe(90);
  });
});
