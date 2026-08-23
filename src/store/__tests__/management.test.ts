import { Group, Room, Shade, ShadeType, TiltType } from '@/models/index';
import { useAppStore } from '@/store/appStore';
import {
  deleteRoom,
  linkShadeToGroup,
  reorderRooms,
  reorderShades,
  saveShadeSettings,
} from '@/store/management';

// Die Verwaltungsaktionen sprechen ausschließlich über getApi().endpoints —
// hier durch eine Attrappe ersetzt, die aufzeichnet und Antworten liefert.
// Der Name muss mit "mock" beginnen — jest.mock() darf sonst keine Variable
// von außerhalb der Fabrik referenzieren.
const mockEndpoints = {
  saveShade: jest.fn(),
  saveRoom: jest.fn(),
  saveGroup: jest.fn(),
  addRoom: jest.fn(),
  addGroup: jest.fn(),
  deleteRoom: jest.fn(),
  deleteGroup: jest.fn(),
  deleteShade: jest.fn(),
  linkToGroup: jest.fn(),
  unlinkFromGroup: jest.fn(),
  shadeSortOrder: jest.fn(),
  roomSortOrder: jest.fn(),
  groupSortOrder: jest.fn(),
};

jest.mock('@/api/index', () => ({
  getApi: () => ({ endpoints: mockEndpoints }),
}));

function makeShade(shadeId: number, overrides: Partial<Shade> = {}): Shade {
  return {
    shadeId,
    shadeType: ShadeType.roller,
    remoteAddress: 571000 + shadeId,
    name: `Rollo ${shadeId}`,
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
    sortOrder: shadeId,
    roomId: 0,
    ...overrides,
  };
}

function makeRoom(roomId: number, sortOrder = roomId): Room {
  return { roomId, name: `Raum ${roomId}`, sortOrder };
}

function makeGroup(groupId: number, shades: number[] = [], roomId = 0): Group {
  return {
    groupId,
    remoteAddress: 580000 + groupId,
    name: `Gruppe ${groupId}`,
    sunSensor: false,
    shades,
    flags: 0,
    roomId,
  };
}

function seed(shades: Shade[], rooms: Room[] = [], groups: Group[] = []) {
  useAppStore.setState({
    shadesById: Object.fromEntries(shades.map((s) => [s.shadeId, s])),
    roomsById: Object.fromEntries(rooms.map((r) => [r.roomId, r])),
    groupsById: Object.fromEntries(groups.map((g) => [g.groupId, g])),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('saveShadeSettings', () => {
  test('übernimmt die Antwort der Firmware in den Store', async () => {
    seed([makeShade(1)]);
    mockEndpoints.saveShade.mockResolvedValue(makeShade(1, { name: 'Küche', roomId: 2 }));

    await saveShadeSettings(1, { name: 'Küche', roomId: 2 });

    expect(mockEndpoints.saveShade).toHaveBeenCalledWith({ shadeId: 1, name: 'Küche', roomId: 2 });
    expect(useAppStore.getState().shadesById[1].name).toBe('Küche');
    expect(useAppStore.getState().shadesById[1].roomId).toBe(2);
  });

  // Ohne Optimistic Update darf ein Fehler den Store nicht anfassen.
  test('lässt den Store bei einem Fehler unberührt', async () => {
    seed([makeShade(1, { name: 'Alt' })]);
    mockEndpoints.saveShade.mockRejectedValue(new Error('kaputt'));

    await expect(saveShadeSettings(1, { name: 'Neu' })).rejects.toThrow('kaputt');
    expect(useAppStore.getState().shadesById[1].name).toBe('Alt');
  });
});

describe('deleteRoom', () => {
  // Die Firmware setzt die roomId betroffener Rollos und Gruppen zurück und
  // schickt Events. Läuft der Socket nicht, muss die App dasselbe lokal tun —
  // sonst zeigen die Rollos auf einen Raum, den es nicht mehr gibt.
  test('hebt die Zuordnung von Rollos und Gruppen auf', async () => {
    seed(
      [makeShade(1, { roomId: 5 }), makeShade(2, { roomId: 9 })],
      [makeRoom(5), makeRoom(9)],
      [makeGroup(1, [1], 5)]
    );
    mockEndpoints.deleteRoom.mockResolvedValue(undefined);

    await deleteRoom(5);

    const state = useAppStore.getState();
    expect(state.roomsById[5]).toBeUndefined();
    expect(state.shadesById[1].roomId).toBe(0);
    expect(state.groupsById[1].roomId).toBe(0);
    // Ein anderer Raum bleibt unangetastet.
    expect(state.shadesById[2].roomId).toBe(9);
    expect(state.roomsById[9]).toBeDefined();
  });

  test('löscht nichts, wenn die Firmware ablehnt', async () => {
    seed([makeShade(1, { roomId: 5 })], [makeRoom(5)]);
    mockEndpoints.deleteRoom.mockRejectedValue(new Error('Room with the specified id not found.'));

    await expect(deleteRoom(5)).rejects.toThrow();
    expect(useAppStore.getState().roomsById[5]).toBeDefined();
    expect(useAppStore.getState().shadesById[1].roomId).toBe(5);
  });
});

describe('Sortierung', () => {
  // Die *SortOrder-Handler der Firmware setzen sortOrder ohne emitState — es
  // kommt kein Event, das die App übernehmen könnte.
  test('übernimmt die neue Reihenfolge lokal', async () => {
    seed([makeShade(1), makeShade(2), makeShade(3)]);
    mockEndpoints.shadeSortOrder.mockResolvedValue(undefined);

    await reorderShades([3, 1, 2]);

    expect(mockEndpoints.shadeSortOrder).toHaveBeenCalledWith([3, 1, 2]);
    const shades = useAppStore.getState().shadesById;
    expect(shades[3].sortOrder).toBe(0);
    expect(shades[1].sortOrder).toBe(1);
    expect(shades[2].sortOrder).toBe(2);
  });

  test('greift auch für Räume', async () => {
    seed([], [makeRoom(1), makeRoom(2)]);
    mockEndpoints.roomSortOrder.mockResolvedValue(undefined);

    await reorderRooms([2, 1]);

    expect(useAppStore.getState().roomsById[2].sortOrder).toBe(0);
    expect(useAppStore.getState().roomsById[1].sortOrder).toBe(1);
  });

  test('lässt die Reihenfolge bei einem Fehler unverändert', async () => {
    seed([makeShade(1, { sortOrder: 7 })]);
    mockEndpoints.shadeSortOrder.mockRejectedValue(new Error('Invalid HTTP Method: '));

    await expect(reorderShades([1])).rejects.toThrow();
    expect(useAppStore.getState().shadesById[1].sortOrder).toBe(7);
  });
});

describe('Gruppenmitgliedschaft', () => {
  test('übernimmt die geänderte Mitgliederliste aus der Antwort', async () => {
    seed([makeShade(1), makeShade(2)], [], [makeGroup(1, [1])]);
    mockEndpoints.linkToGroup.mockResolvedValue(makeGroup(1, [1, 2]));

    await linkShadeToGroup(2, 1);

    expect(mockEndpoints.linkToGroup).toHaveBeenCalledWith({ shadeId: 2, groupId: 1 });
    expect(useAppStore.getState().groupsById[1].shades).toEqual([1, 2]);
  });
});
