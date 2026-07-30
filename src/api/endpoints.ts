import {
  ControllerResponse,
  DiscoveryResponse,
  Group,
  Room,
  Shade,
  SomfyCommand,
} from '@/models/index';

import { ApiClient } from './client';

// Kommando an ein Rollo: ENTWEDER command ODER target (0–100), optional repeat/stepSize.
// command ist bewusst auf die SomfyCommand-Union beschränkt — unbekannte Strings
// fallen in der Firmware still auf 'My' zurück (translateSomfyCommand).
export type ShadeCommandRequest = { shadeId: number; repeat?: number; stepSize?: number } & (
  | { command: SomfyCommand; target?: never }
  | { target: number; command?: never }
);

export type GroupCommandRequest = { groupId: number; repeat?: number } & (
  | { command: SomfyCommand; target?: never }
  | { target: number; command?: never }
);

export interface TiltCommandRequest {
  shadeId: number;
  command?: SomfyCommand;
  target?: number;
}

export interface SetPositionsRequest {
  shadeId: number;
  position?: number;
  tiltPosition?: number;
  myPos?: number;
  myTiltPos?: number;
}

export class Endpoints {
  constructor(private client: ApiClient) {}

  // Lesen (Port 8081) — GETs werden vom Client mit Backoff wiederholt.
  getDiscovery(): Promise<DiscoveryResponse> {
    return this.client.get('/discovery');
  }

  getShades(): Promise<Shade[]> {
    return this.client.get('/shades');
  }

  getRooms(): Promise<Room[]> {
    return this.client.get('/rooms');
  }

  getGroups(): Promise<Group[]> {
    return this.client.get('/groups');
  }

  getController(): Promise<ControllerResponse> {
    return this.client.get('/controller');
  }

  getShade(shadeId: number): Promise<Shade> {
    return this.client.get(`/shade?shadeId=${shadeId}`);
  }

  getRoom(roomId: number): Promise<Room> {
    return this.client.get(`/room?roomId=${roomId}`);
  }

  getGroup(groupId: number): Promise<Group> {
    return this.client.get(`/group?groupId=${groupId}`);
  }

  // Kommandos — werden vom Client NICHT wiederholt. Antworten mit dem vollen Objekt.
  shadeCommand(req: ShadeCommandRequest): Promise<Shade> {
    return this.client.put('/shadeCommand', req);
  }

  groupCommand(req: GroupCommandRequest): Promise<Group> {
    return this.client.put('/groupCommand', req);
  }

  tiltCommand(req: TiltCommandRequest): Promise<Shade> {
    return this.client.put('/tiltCommand', req);
  }

  repeatCommand(): Promise<void> {
    return this.client.put('/repeatCommand');
  }

  // Konfiguration.
  saveShade(shade: Partial<Shade> & { shadeId: number }): Promise<Shade> {
    return this.client.put('/shade', shade);
  }

  saveRoom(room: Partial<Room> & { roomId: number }): Promise<Room> {
    return this.client.put('/room', room);
  }

  saveGroup(group: Partial<Group> & { groupId: number }): Promise<Group> {
    return this.client.put('/group', group);
  }

  setPositions(req: SetPositionsRequest): Promise<Shade> {
    return this.client.put('/setPositions', req);
  }

  setSensor(req: { shadeId: number; sunSensor?: boolean; light?: boolean }): Promise<Shade> {
    return this.client.put('/setSensor', req);
  }

  backup(): Promise<string> {
    return this.client.get('/backup');
  }

  reboot(): Promise<void> {
    return this.client.put('/reboot');
  }
}
