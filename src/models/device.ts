import { SecurityType } from './enums';
import { Group } from './group';
import { Room } from './room';
import { Shade } from './shade';

export interface MemoryStatus {
  max: number;
  free: number;
  min: number;
  total: number;
}

// GET /discovery — ein Request liefert Räume, Rollos, Gruppen und Gerätestatus.
export interface DiscoveryResponse {
  serverId: string;
  version: string;
  latest: string;
  model: string;
  hostname: string;
  authType: SecurityType;
  permissions: number;
  chipModel: string;
  connType: string;
  checkForUpdate: boolean;
  memory: MemoryStatus;
  rooms: Room[];
  shades: Shade[];
  groups: Group[];
}

export interface FirmwareVersion {
  name: string;
  major: number;
  minor: number;
  build: number;
  suffix: string;
}

export interface VersionInfo {
  available: boolean;
  status: number;
  error: number;
  cancelled: boolean;
  checkForUpdate: boolean;
  inetAvailable: boolean;
  fwVersion: FirmwareVersion;
  appVersion: FirmwareVersion;
  latest: FirmwareVersion;
}

// GET /controller — Limits, Funkkonfiguration, Versionen.
export interface ControllerResponse {
  maxRooms: number;
  maxShades: number;
  maxGroups: number;
  maxGroupedShades: number;
  maxLinkedRemotes: number;
  startingAddress: number;
  transceiver: { config: Record<string, unknown> };
  version: VersionInfo;
  rooms: Room[];
  shades: Shade[];
  groups: Group[];
  repeaters: unknown[];
}

// POST /login — auch bei authType 0 kommt sofort ein apiKey zurück.
export interface LoginResponse {
  success: boolean;
  type: SecurityType;
  apiKey: string;
  msg: string;
}

// Fehler der Firmware kommen als HTTP 500 mit diesem Body (nicht als 4xx).
export interface FirmwareError {
  status: 'ERROR' | string;
  desc: string;
}

// Socket-Event `wifiStrength`. Die Firmware sendet es nur, wenn sich RSSI um mehr
// als 1 dBm oder der Kanal geändert hat (Network.cpp:172) — kein fester Takt.
// Ohne Verbindung kommt ssid "" mit strength -100 und channel -1.
export interface WifiStrengthEvent {
  ssid: string;
  strength: number;
  channel: number;
}

// Socket-Event `ethernet` (Network.cpp:181). Kommt nur auf Geräten mit LAN-Anschluss
// und zusätzlich als Abmeldung, wenn das WLAN wegbricht.
export interface EthernetEvent {
  connected: boolean;
  speed: number;
  fullduplex: boolean;
}

/** Ein RSSI-Messpunkt mit dem Zeitpunkt seines Eintreffens (Date.now()). */
export interface WifiSample {
  at: number;
  strength: number;
}
