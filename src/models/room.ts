// Raum (SomfyRoom::emitState). roomId 0 auf einem Rollo bedeutet „kein Raum".
export interface Room {
  roomId: number;
  name: string;
  sortOrder: number;
}

export type RoomPatch = Partial<Room> & { roomId: number };
