import { Room, Shade } from '@/models/index';

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
