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

// Socket-Event `wifiStrength`.
export interface WifiStrengthEvent {
  ssid: string;
  strength: number;
  channel: number;
}
