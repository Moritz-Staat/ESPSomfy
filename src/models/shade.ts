import { ShadeType, TiltType } from './enums';

// Positions-Semantik (gilt für position, target, myPos, tiltPosition, tiltTarget, myTiltPos):
// - Wertebereich 0–100. Die Firmware hat transformPosition() BEREITS angewendet:
//   bei flipPosition === true sind die Werte schon gespiegelt.
//   Die App darf NIEMALS erneut spiegeln.
// - myPos außerhalb 0–100 bedeutet „kein Favorit gesetzt". Das echte Gerät (v2.4.6)
//   liefert dafür -1 (transformPosition gibt für negative Werte -1 zurück); die
//   Firmware-Doku nennt 255. Beides wird als „kein Favorit" behandelt → hasFavorite().
// - direction: -1 öffnet, 0 steht, 1 schließt.

export interface LinkedRemote {
  remoteAddress: number;
  lastRollingCode: number;
}

// Rollo-Zustand. Kernfelder kommen sowohl per REST als auch im Socket-Event
// `shadeState`. Die als optional markierten REST-Felder fehlen im Socket-Event.
export interface Shade {
  shadeId: number;
  // REST liefert `shadeType`, das Socket-Event `type` — normalizeShadeState() vereinheitlicht.
  shadeType: ShadeType;
  remoteAddress: number;
  name: string;
  direction: number;
  position: number;
  target: number;
  myPos: number;
  tiltType: TiltType;
  flipCommands: boolean;
  flipPosition: boolean;
  flags: number;
  sunSensor: boolean;
  light: boolean;
  sortOrder: number;

  // Nur vorhanden wenn tiltType !== none (Socket) bzw. immer 0 (REST bei tiltType none).
  // Beim Store-Merge dürfen fehlende Tilt-Felder nie auf undefined zurückgesetzt werden.
  tiltDirection?: number;
  tiltTarget?: number;
  tiltPosition?: number;
  myTiltPos?: number;

  // Zusätzliche Felder, die nur die REST-Antworten (/shades, /discovery, /controller)
  // liefern, nicht das Socket-Event (am echten Gerät v2.4.6 verifiziert).
  roomId?: number;
  upTime?: number;
  downTime?: number;
  paired?: boolean;
  lastRollingCode?: number;
  tiltTime?: number;
  stepSize?: number;
  bitLength?: number;
  proto?: number;
  inGroup?: boolean;
  repeats?: number;
  gpioUp?: number;
  gpioDown?: number;
  gpioMy?: number;
  gpioLLTrigger?: boolean;
  simMy?: boolean;
  linkedRemotes?: LinkedRemote[];
}

// Rohes Socket-Event `shadeState` — trägt den Rollo-Typ als `type`.
export interface RawShadeStateEvent {
  shadeId: number;
  type: ShadeType;
  remoteAddress: number;
  name: string;
  direction: number;
  position: number;
  target: number;
  myPos: number;
  tiltType: TiltType;
  flipCommands: boolean;
  flipPosition: boolean;
  flags: number;
  sunSensor: boolean;
  light: boolean;
  sortOrder: number;
  tiltDirection?: number;
  tiltTarget?: number;
  tiltPosition?: number;
  myTiltPos?: number;
}

// Socket-Event `shadeCommand`.
export interface ShadeCommandEvent {
  shadeId: number;
  remoteAddress: number;
  cmd: string;
  source: string;
  rcode: number;
  sourceAddress: number;
}

export type ShadePatch = Partial<Shade> & { shadeId: number };

// Vereinheitlicht das Socket-Event auf das Shade-Interface (`type` → `shadeType`).
export function normalizeShadeState(raw: RawShadeStateEvent): ShadePatch {
  const { type, ...rest } = raw;
  return { ...rest, shadeType: type };
}

export function hasFavorite(myPos: number | undefined): boolean {
  return myPos !== undefined && myPos >= 0 && myPos <= 100;
}

export function isMoving(shade: Pick<Shade, 'direction'>): boolean {
  return shade.direction !== 0;
}

// Somfy kennt für den Favoriten nur einen Befehl: Steht das Rollo auf der
// gespeicherten Favoritenposition und wird genau dieser Wert erneut gesendet,
// LÖSCHT die Firmware den Favoriten, statt ihn zu setzen (SomfyShade::setMyPosition).
// Bei Rollos mit Lamellen müssen dafür beide Achsen übereinstimmen.
export function clearsFavorite(
  shade: Pick<Shade, 'myPos' | 'myTiltPos' | 'tiltType'>,
  pos: number,
  tilt?: number
): boolean {
  if (shade.tiltType === TiltType.tiltonly) {
    return hasFavorite(shade.myTiltPos) && tilt === shade.myTiltPos;
  }
  if (!hasFavorite(shade.myPos) || pos !== shade.myPos) return false;
  if (shade.tiltType === TiltType.none) return true;
  return tilt === shade.myTiltPos;
}
