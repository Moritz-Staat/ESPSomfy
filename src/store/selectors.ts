import { Group, isMoving, Room, Shade } from '@/models/index';

import { AppState } from './appStore';

export interface RoomSection {
  roomId: number;
  title: string;
  sortOrder: number;
  shades: Shade[];
}

export const UNASSIGNED_ROOM_ID = 0;

// Nach Raum gruppiert, Räume und Rollos jeweils nach sortOrder;
// Rollos ohne Raum (roomId 0 oder unbekannter Raum) landen in „Ohne Raum" am Ende.
export function selectRoomSections(state: Pick<AppState, 'shadesById' | 'roomsById'>): RoomSection[] {
  const rooms = Object.values(state.roomsById) as Room[];
  const shades = Object.values(state.shadesById) as Shade[];
  const byRoom = new Map<number, Shade[]>();
  for (const shade of shades) {
    const roomId =
      shade.roomId !== undefined && state.roomsById[shade.roomId]
        ? shade.roomId
        : UNASSIGNED_ROOM_ID;
    const list = byRoom.get(roomId) ?? [];
    list.push(shade);
    byRoom.set(roomId, list);
  }

  const sections: RoomSection[] = [];
  for (const room of [...rooms].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const roomShades = byRoom.get(room.roomId);
    if (roomShades?.length) {
      sections.push({
        roomId: room.roomId,
        title: room.name,
        sortOrder: room.sortOrder,
        shades: roomShades.sort((a, b) => a.sortOrder - b.sortOrder),
      });
    }
  }
  const unassigned = byRoom.get(UNASSIGNED_ROOM_ID);
  if (unassigned?.length) {
    sections.push({
      roomId: UNASSIGNED_ROOM_ID,
      title: 'Ohne Raum',
      sortOrder: Number.MAX_SAFE_INTEGER,
      shades: unassigned.sort((a, b) => a.sortOrder - b.sortOrder),
    });
  }
  return sections;
}

// Gruppen tragen sortOrder erst, seit die App sie über /groupSortOrder setzt —
// im Modell ist das Feld deshalb optional. Fehlt es (oder ist es bei allen 0, wie
// bei einem Gerät, auf dem nie sortiert wurde), entscheidet die groupId, damit die
// Reihenfolge stabil bleibt statt an der Objektreihenfolge zu hängen.
export function compareGroups(a: Group, b: Group): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.groupId - b.groupId;
}

export interface GroupSummary {
  group: Group;
  members: Shade[];
  /** Gemeinsame Position aller Mitglieder, oder null bei uneinheitlichem Stand. */
  position: number | null;
  /** Mindestens ein Mitglied fährt gerade. */
  moving: boolean;
}

// Gruppen tragen selbst keine Position — die Firmware schätzt nur die Positionen
// der einzelnen Rollos. Der angezeigte Zustand wird deshalb aus den Mitgliedern
// abgeleitet; sind sie uneinheitlich, wird das als „gemischt" gezeigt, statt eine
// Zahl zu behaupten, die keinem Rollo entspricht.
export function selectGroupSummaries(
  state: Pick<AppState, 'groupsById' | 'shadesById'>
): GroupSummary[] {
  const groups = Object.values(state.groupsById) as Group[];
  return groups
    .map((group) => {
      // group.shades trägt die Mitglieds-Ids; unbekannte Ids werden übersprungen,
      // damit eine noch nicht nachgeladene Gruppe die Liste nicht sprengt.
      const members = group.shades
        .map((shadeId) => state.shadesById[shadeId])
        .filter((shade): shade is Shade => shade !== undefined)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const positions = new Set(members.map((shade) => shade.position));
      return {
        group,
        members,
        position: positions.size === 1 ? [...positions][0] : null,
        moving: members.some(isMoving),
      };
    })
    .sort((a, b) => compareGroups(a.group, b.group));
}
