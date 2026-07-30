import { DiscoveryResponse, SecurityType, Shade, ShadeType, TiltType } from '@/models/index';
import { OPTIMISTIC_ROLLBACK_MS, useAppStore } from '@/store/appStore';
import { selectRoomSections } from '@/store/selectors';
import { dispatchSocketFrame } from '@/store/socketBridge';

function makeShade(overrides: Partial<Shade> & { shadeId: number }): Shade {
  return {
    shadeType: ShadeType.roller,
    remoteAddress: 571000 + overrides.shadeId,
    name: `Rollo ${overrides.shadeId}`,
    direction: 0,
    position: 0,
    target: 0,
    myPos: -1,
    tiltType: TiltType.none,
    flipCommands: false,
    flipPosition: false,
    flags: 0,
    sunSensor: false,
    light: false,
    sortOrder: overrides.shadeId,
    ...overrides,
  };
}

function makeDiscovery(shades: Shade[]): DiscoveryResponse {
  return {
    serverId: '000000',
    version: 'v2.4.6',
    latest: 'v2.4.6',
    model: 'ESPSomfyRTS',
    hostname: 'ESPSomfyRTS',
    authType: SecurityType.None,
    permissions: 0,
    chipModel: '',
    connType: 'Wifi',
    checkForUpdate: true,
    memory: { max: 1, free: 1, min: 1, total: 1 },
    rooms: [
      { roomId: 1, name: 'Wohnzimmer', sortOrder: 0 },
      { roomId: 2, name: 'Schlafzimmer', sortOrder: 1 },
    ],
    shades,
    groups: [],
  };
}

beforeEach(() => {
  useAppStore.setState({
    shadesById: {},
    groupsById: {},
    roomsById: {},
    device: null,
    connectionStatus: 'offline',
    hydrated: false,
  });
});

describe('Store-Merge', () => {
  test('Hydration übernimmt Rollos, Räume und Gerätestatus', () => {
    const store = useAppStore.getState();
    store.hydrate(makeDiscovery([makeShade({ shadeId: 1, roomId: 1 })]));
    const state = useAppStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.shadesById[1].name).toBe('Rollo 1');
    expect(state.roomsById[2].name).toBe('Schlafzimmer');
    expect(state.device?.version).toBe('v2.4.6');
  });

  test('Socket-Events überschreiben nur enthaltene Felder, nie das ganze Objekt', () => {
    const store = useAppStore.getState();
    store.hydrate(makeDiscovery([makeShade({ shadeId: 1, roomId: 1, upTime: 14000 })]));
    store.applyShadeState({ shadeId: 1, position: 45, direction: 1 });
    const shade = useAppStore.getState().shadesById[1];
    expect(shade.position).toBe(45);
    expect(shade.direction).toBe(1);
    // REST-Felder, die im Socket-Event fehlen, bleiben erhalten.
    expect(shade.upTime).toBe(14000);
    expect(shade.roomId).toBe(1);
  });

  test('Tilt-Sonderfall: Event ohne Tilt-Felder löscht vorhandene Tilt-Werte nicht', () => {
    const store = useAppStore.getState();
    store.hydrate(
      makeDiscovery([
        makeShade({ shadeId: 1, tiltType: TiltType.integrated, tiltPosition: 40, myTiltPos: 60 }),
      ])
    );
    // Patch mit explizit undefined-Werten (wie ein gespreadetes Partial) darf nichts löschen.
    store.applyShadeState({ shadeId: 1, position: 10, tiltPosition: undefined, myTiltPos: undefined });
    const shade = useAppStore.getState().shadesById[1];
    expect(shade.position).toBe(10);
    expect(shade.tiltPosition).toBe(40);
    expect(shade.myTiltPos).toBe(60);
  });

  test('shadeState-Frame über die Socket-Bridge normalisiert type → shadeType', () => {
    const store = useAppStore.getState();
    store.hydrate(makeDiscovery([makeShade({ shadeId: 1 })]));
    dispatchSocketFrame({
      event: 'shadeState',
      payload: { shadeId: 1, type: 4, position: 80, direction: 0 },
    });
    const shade = useAppStore.getState().shadesById[1];
    expect(shade.shadeType).toBe(ShadeType.shutter);
    expect(shade.position).toBe(80);
    expect('type' in shade).toBe(false);
  });
});

describe('Optimistic Update mit Rollback', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('rollt nach 3 s ohne Bestätigung zurück', () => {
    const store = useAppStore.getState();
    store.hydrate(makeDiscovery([makeShade({ shadeId: 1, position: 20, target: 20 })]));
    store.applyOptimistic(1, { direction: 1, target: 100 });
    expect(useAppStore.getState().shadesById[1].direction).toBe(1);
    expect(useAppStore.getState().shadesById[1].target).toBe(100);

    jest.advanceTimersByTime(OPTIMISTIC_ROLLBACK_MS + 1);
    const shade = useAppStore.getState().shadesById[1];
    expect(shade.direction).toBe(0);
    expect(shade.target).toBe(20);
    expect(shade.position).toBe(20);
  });

  test('bestätigendes shadeState bricht den Rollback ab — Socket-Events gewinnen', () => {
    const store = useAppStore.getState();
    store.hydrate(makeDiscovery([makeShade({ shadeId: 1, position: 20, target: 20 })]));
    store.applyOptimistic(1, { direction: 1, target: 100 });
    // Gerät bestätigt mit echten Werten (Motorlaufzeit-Rechnung der Firmware).
    store.applyShadeState({ shadeId: 1, direction: 1, target: 100, position: 25 });

    jest.advanceTimersByTime(OPTIMISTIC_ROLLBACK_MS + 1);
    const shade = useAppStore.getState().shadesById[1];
    expect(shade.direction).toBe(1);
    expect(shade.target).toBe(100);
    expect(shade.position).toBe(25);
  });
});

describe('Selektoren', () => {
  test('gruppiert nach Raum, sortiert nach sortOrder, Rest in „Ohne Raum"', () => {
    const store = useAppStore.getState();
    store.hydrate(
      makeDiscovery([
        makeShade({ shadeId: 1, roomId: 2, sortOrder: 2 }),
        makeShade({ shadeId: 2, roomId: 2, sortOrder: 1 }),
        makeShade({ shadeId: 3, roomId: 0, sortOrder: 5 }),
        makeShade({ shadeId: 4, roomId: 99, sortOrder: 0 }),
      ])
    );
    const sections = selectRoomSections(useAppStore.getState());
    expect(sections.map((s) => s.title)).toEqual(['Schlafzimmer', 'Ohne Raum']);
    expect(sections[0].shades.map((s) => s.shadeId)).toEqual([2, 1]);
    // roomId 0 und unbekannte Räume landen in „Ohne Raum".
    expect(sections[1].shades.map((s) => s.shadeId)).toEqual([4, 3]);
  });
});
