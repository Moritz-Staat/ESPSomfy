// Enums aus der Firmware (ESPSomfy-RTS v2.4.6, Somfy.h / ConfigSettings.h).

export enum ShadeType {
  roller = 0,
  blind = 1,
  ldrapery = 2,
  awning = 3,
  shutter = 4,
  garage1 = 5,
  garage3 = 6,
  rdrapery = 7,
  cdrapery = 8,
  drycontact = 9,
  drycontact2 = 10,
  lgate = 11,
  cgate = 12,
  rgate = 13,
  lgate1 = 14,
  cgate1 = 15,
  rgate1 = 16,
}

export enum TiltType {
  none = 0,
  tiltmotor = 1,
  integrated = 2,
  tiltonly = 3,
  euromode = 4,
}

export enum SecurityType {
  None = 0,
  PinEntry = 1,
  Password = 2,
}

// Berechtigungs-Bits im `permissions`-Feld von /discovery und /login.
// Bit 0x01 gesetzt = ConfigOnly: Lesen und Steuern OHNE Auth erlaubt, nur Config geschützt.
export const PERMISSION_CONFIG_ONLY = 0x01;

// Befehlsnamen — der Firmware-Vergleich (translateSomfyCommand) ist case-insensitiv.
// WICHTIG: Unbekannte Strings fallen in der Firmware STILL auf 'My' zurück (= Stopp/Favorit).
// Deshalb ausschließlich diese Union verwenden, niemals freie Strings oder
// Einzelbuchstaben-Kurzformen ("s" wäre SunFlag, nicht Stop!).
export type SomfyCommand =
  | 'My'
  | 'Up'
  | 'Down'
  | 'MyUp'
  | 'MyDown'
  | 'UpDown'
  | 'MyUpDown'
  | 'Prog'
  | 'SunFlag'
  | 'StepUp'
  | 'StepDown'
  | 'Flag'
  | 'Sensor'
  | 'Toggle'
  | 'Favorite'
  | 'Stop';

export const SOMFY_COMMANDS: readonly SomfyCommand[] = [
  'My',
  'Up',
  'Down',
  'MyUp',
  'MyDown',
  'UpDown',
  'MyUpDown',
  'Prog',
  'SunFlag',
  'StepUp',
  'StepDown',
  'Flag',
  'Sensor',
  'Toggle',
  'Favorite',
  'Stop',
] as const;

// Systemgrenzen (verifiziert gegen GET /controller des echten Geräts).
export const LIMITS = {
  maxShades: 32,
  maxGroups: 16,
  maxRooms: 16,
  maxGroupedShades: 32,
  maxLinkedRemotes: 7,
  // char name[21] in Somfy.h — 20 Zeichen plus Nullterminator, fuer Rollos,
  // Raeume und Gruppen gleichermassen.
  maxNameLength: 20,
} as const;
