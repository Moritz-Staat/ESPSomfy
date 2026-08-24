import { MemoryStatus } from './device';

// Ableitungen für den Diagnose-Screen. Bewusst ohne React und ohne Store, damit
// die Schwellen und Formeln für sich testbar bleiben.

export type HeapLevel = 'ok' | 'warn' | 'critical';

// Ein ESP32 mit dauerhaft wenig freiem Heap fängt an, Verbindungen abzuweisen und
// schließlich neu zu starten. Die Schwellen stammen aus der Praxis, nicht aus der
// Firmware — dort steht keine.
export const HEAP_WARN_BYTES = 60_000;
export const HEAP_CRITICAL_BYTES = 30_000;

export function heapLevel(free: number): HeapLevel {
  if (free < HEAP_CRITICAL_BYTES) return 'critical';
  if (free < HEAP_WARN_BYTES) return 'warn';
  return 'ok';
}

// Nicht free/total: `max` ist der größte am Stück belegbare Block. Liegt er weit
// unter free, ist der Heap fragmentiert — das ist der Zustand, in dem ein Gerät
// scheinbar grundlos abstürzt, obwohl „genug" frei ist.
export function fragmentation(memory: MemoryStatus): number {
  if (memory.free <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - memory.max / memory.free));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// RSSI-Skala für die Anzeige. Unter -90 dBm bricht WLAN praktisch zusammen,
// über -50 dBm bringt mehr Signal nichts mehr.
export const RSSI_FLOOR = -95;
export const RSSI_CEILING = -45;

/** RSSI → 0…1 für Balkenhöhen. */
export function rssiFraction(strength: number): number {
  const span = RSSI_CEILING - RSSI_FLOOR;
  return Math.max(0, Math.min(1, (strength - RSSI_FLOOR) / span));
}

export type SignalLevel = 'good' | 'fair' | 'weak' | 'none';

export function signalLevel(strength: number): SignalLevel {
  // -100 mit leerer SSID ist der Wert, den die Firmware ohne Verbindung sendet.
  if (strength <= -100) return 'none';
  if (strength >= -67) return 'good';
  if (strength >= -80) return 'fair';
  return 'weak';
}

export const SIGNAL_LABELS: Record<SignalLevel, string> = {
  good: 'Gut',
  fair: 'Ausreichend',
  weak: 'Schwach',
  none: 'Keine Verbindung',
};

// Die Firmware trägt in `latest` die neueste Version aus dem GitHub-Repo ein —
// aber nur, wenn checkForUpdate an ist. Ist die Prüfung aus, steht dort der eigene
// Stand oder nichts; dann darf die App kein Update behaupten.
export function updateAvailable(device: {
  version: string;
  latest: string;
  checkForUpdate: boolean;
}): boolean {
  if (!device.checkForUpdate) return false;
  if (!device.latest || !device.version) return false;
  return device.latest !== device.version;
}

/** Dateiname im Stil des Web-UI: ESPSomfyRTS <ISO-Zeit>.backup, ohne verbotene Zeichen. */
export function backupFilename(at: Date): string {
  const iso = at.toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '_');
  return `ESPSomfyRTS ${iso}.backup`;
}
