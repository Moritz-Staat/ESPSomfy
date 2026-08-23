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

export interface LinkToGroupRequest {
  shadeId: number;
  groupId: number;
}

export interface SetMyPositionRequest {
  shadeId: number;
  /** Zielposition 0–100. Werte außerhalb bewirken nichts (die Firmware prüft). */
  pos: number;
  /** Lamellenziel. Bei Rollos mit Tilt IMMER mitgeben — siehe Kommentar unten. */
  tilt?: number;
}

// Die Firmware verteilt ihre Routen auf zwei Server:
//   - apiClient  → Port 8081: Lesen, Fahrbefehle, setPositions, setSensor, backup, reboot
//   - configClient → Port 80: sämtliche Verwaltung (save*, add*, delete*, *SortOrder, …)
// Verwaltungsrouten sind auf 8081 NICHT registriert; ein PUT dorthin läuft ins Leere.
export class Endpoints {
  constructor(
    private client: ApiClient,
    private config: ApiClient
  ) {}

  // ---------------------------------------------------------------- Lesen (8081)
  // GETs werden vom Client mit Backoff wiederholt.

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

  // ------------------------------------------------------------ Kommandos (8081)
  // Werden vom Client NICHT wiederholt. Antworten mit dem vollen Objekt.

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

  // Schreibt Position, Tilt und Favorit NUR in die Datenbank des ESP — der Motor
  // erfährt davon nichts. Zum Programmieren des Favoriten ist setMyPosition zuständig.
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

  // ---------------------------------------------------------- Verwaltung (Port 80)

  saveShade(shade: Partial<Shade> & { shadeId: number }): Promise<Shade> {
    return this.config.put('/saveShade', shade);
  }

  saveRoom(room: Partial<Room> & { roomId: number }): Promise<Room> {
    return this.config.put('/saveRoom', room);
  }

  saveGroup(group: Partial<Group> & { groupId: number }): Promise<Group> {
    return this.config.put('/saveGroup', group);
  }

  addRoom(room: { name: string } & Partial<Room>): Promise<Room> {
    return this.config.put('/addRoom', room);
  }

  addGroup(group: { name: string } & Partial<Group>): Promise<Group> {
    return this.config.put('/addGroup', group);
  }

  // Antwortet mit {"status":"SUCCESS"}; wirft ApiError, wenn die Id unbekannt ist.
  deleteRoom(roomId: number): Promise<void> {
    return this.config.put('/deleteRoom', { roomId });
  }

  deleteGroup(groupId: number): Promise<void> {
    return this.config.put('/deleteGroup', { groupId });
  }

  // Sonderfall: HTTP 400, wenn das Rollo Mitglied einer Gruppe ist.
  deleteShade(shadeId: number): Promise<void> {
    return this.config.put('/deleteShade', { shadeId });
  }

  // Achtung: die Firmware behandelt shadeId 0 als „nicht angegeben" und lehnt ab.
  linkToGroup(req: LinkToGroupRequest): Promise<Group> {
    return this.config.put('/linkToGroup', req);
  }

  unlinkFromGroup(req: LinkToGroupRequest): Promise<Group> {
    return this.config.put('/unlinkFromGroup', req);
  }

  // Programmiert den Favoriten im MOTOR (Somfy-My-Befehl mit langer Wiederholung),
  // nicht bloß in der Datenbank. Das Verhalten hängt vom Zustand ab:
  //   - Rollo steht nicht auf pos      → es fährt zuerst dorthin, dann wird gesetzt
  //   - Rollo steht auf pos == myPos   → der Favorit wird GELÖSCHT
  //   - Rollo steht auf pos != myPos   → der Favorit wird gesetzt
  // Es gibt also keinen eigenen Löschbefehl: Löschen heißt, die aktuelle
  // Favoritenposition erneut zu senden. Während einer Fahrt bleibt der Aufruf
  // wirkungslos (isIdle-Prüfung), antwortet aber trotzdem mit HTTP 200.
  //
  // Achtung: Bleibt `tilt` weg, setzt die Firmware `tilt = myPos` — den Wert der
  // FAHRachse (Web.cpp:1550). Bei Rollos mit Lamellen deshalb immer beides senden.
  setMyPosition(req: SetMyPositionRequest): Promise<Shade> {
    return this.config.put('/setMyPosition', req);
  }

  // Die drei SortOrder-Routen erwarten ein nacktes JSON-Array, kein Objekt, und
  // vergeben sortOrder in Array-Reihenfolge. Bei falscher Methode antworten sie mit
  // HTTP 201 und {"status":"ERROR"} — das fängt die Fehlerprüfung im Client ab.
  shadeSortOrder(shadeIds: number[]): Promise<void> {
    return this.config.put('/shadeSortOrder', shadeIds);
  }

  roomSortOrder(roomIds: number[]): Promise<void> {
    return this.config.put('/roomSortOrder', roomIds);
  }

  groupSortOrder(groupIds: number[]): Promise<void> {
    return this.config.put('/groupSortOrder', groupIds);
  }
}
