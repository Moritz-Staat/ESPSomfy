// Gruppe (SomfyGroup::emitState). `flags` ist das OR aller Mitglieds-Rollo-Flags.
export interface Group {
  groupId: number;
  remoteAddress: number;
  name: string;
  sunSensor: boolean;
  shades: number[];
  flags: number;
  // Gruppen hängen wie Rollos an einem Raum: deleteRoom setzt beides zurück
  // (Somfy.cpp:4052). Fehlt in manchen Socket-Events, deshalb optional.
  roomId?: number;
  // Die Firmware führt sortOrder auch für Gruppen (/groupSortOrder).
  sortOrder?: number;
}

export type GroupPatch = Partial<Group> & { groupId: number };
