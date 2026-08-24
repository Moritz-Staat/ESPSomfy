import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';

import { CONFIG_PORT, getApi } from '@/api/index';
import { backupFilename } from '@/models/index';

import { useAppStore } from './appStore';

// Aktionen des Diagnose-Screens. Sie fassen den Store nicht an: Ein Backup ändert
// nichts am Gerätezustand, und was ein Neustart bewirkt, meldet der Socket von
// selbst (Verbindung bricht weg, Watchdog verbindet neu).

export interface BackupResult {
  filename: string;
  /** true, wenn das System-Share-Sheet aufging; false, wenn die Plattform keins hat. */
  shared: boolean;
}

// GET /backup liefert den Inhalt von controller.backup als Text. Der Weg über eine
// Datei im Cache ist nötig, weil das Share-Sheet nur eine URI teilt, keinen String.
export async function downloadBackup(): Promise<BackupResult> {
  const content = await getApi().endpoints.backup();
  const filename = backupFilename(new Date());
  const file = new File(Paths.cache, filename);
  // overwrite: Ein Backup mit demselben Zeitstempel kann nur der Rest eines
  // abgebrochenen Versuchs sein — create() würde sonst werfen.
  file.create({ overwrite: true });
  file.write(content);

  if (!(await Sharing.isAvailableAsync())) {
    return { filename, shared: false };
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Sicherung teilen',
    UTI: 'public.json',
  });
  return { filename, shared: true };
}

// PUT, nicht GET: Auf ein GET antwortet /reboot mit HTTP 201 und status ERROR
// (Web.cpp:1055), ohne neu zu starten.
export async function rebootDevice(): Promise<void> {
  await getApi().endpoints.reboot();
}

/**
 * Adresse des Web-UI (Port 80) — dieselbe Basis, über die die Verwaltung läuft.
 * Bewusst aus dem Store statt aus `getApi()`: Die Funktion läuft beim Rendern, und
 * `getApi()` wirft, solange noch keine Verbindung aufgebaut wurde.
 */
export function webUiUrl(): string {
  const host = useAppStore.getState().host;
  if (!host) return '';
  // Port 80 gehört nicht in die Adresse — er ist der Standard für http.
  return CONFIG_PORT === 80 ? `http://${host}/` : `http://${host}:${CONFIG_PORT}/`;
}

export async function openWebUi(): Promise<void> {
  const url = webUiUrl();
  if (url) await Linking.openURL(url);
}
