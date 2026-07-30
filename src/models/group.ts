// Gruppe (SomfyGroup::emitState). `flags` ist das OR aller Mitglieds-Rollo-Flags.
export interface Group {
  groupId: number;
  remoteAddress: number;
  name: string;
  sunSensor: boolean;
  shades: number[];
  flags: number;
}

export type GroupPatch = Partial<Group> & { groupId: number };
