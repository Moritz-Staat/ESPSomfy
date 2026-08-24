import {
  backupFilename,
  formatBytes,
  fragmentation,
  heapLevel,
  HEAP_CRITICAL_BYTES,
  HEAP_WARN_BYTES,
  rssiFraction,
  RSSI_CEILING,
  RSSI_FLOOR,
  signalLevel,
  updateAvailable,
} from '@/models/index';

describe('heapLevel', () => {
  test('staffelt an den Schwellen', () => {
    expect(heapLevel(HEAP_WARN_BYTES + 1)).toBe('ok');
    expect(heapLevel(HEAP_WARN_BYTES - 1)).toBe('warn');
    expect(heapLevel(HEAP_CRITICAL_BYTES - 1)).toBe('critical');
  });
});

describe('fragmentation', () => {
  test('ist 0, wenn der ganze freie Speicher am Stück verfügbar ist', () => {
    expect(fragmentation({ free: 100000, max: 100000, min: 50000, total: 260000 })).toBe(0);
  });

  test('erkennt einen zerstückelten Heap', () => {
    // Genau der Zustand, in dem ein Gerät „genug frei" meldet und trotzdem abstürzt.
    expect(fragmentation({ free: 100000, max: 25000, min: 50000, total: 260000 })).toBeCloseTo(
      0.75
    );
  });

  test('bleibt bei leerem oder widersprüchlichem Stand im Rahmen', () => {
    expect(fragmentation({ free: 0, max: 0, min: 0, total: 0 })).toBe(0);
    // max > free kommt bei zeitversetzten Messungen vor und darf nicht negativ werden.
    expect(fragmentation({ free: 1000, max: 5000, min: 500, total: 260000 })).toBe(0);
  });
});

describe('formatBytes', () => {
  test('schaltet bei 1 KB auf Kilobyte um', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(30720)).toBe('30.0 KB');
  });
});

describe('rssiFraction', () => {
  test('bildet die Skala auf 0…1 ab und begrenzt an den Rändern', () => {
    expect(rssiFraction(RSSI_FLOOR)).toBe(0);
    expect(rssiFraction(RSSI_CEILING)).toBe(1);
    expect(rssiFraction(-70)).toBeCloseTo(0.5);
    expect(rssiFraction(-120)).toBe(0);
    expect(rssiFraction(-10)).toBe(1);
  });
});

describe('signalLevel', () => {
  test('erkennt den Ersatzwert der Firmware für „kein WLAN"', () => {
    // Network.cpp:200 sendet ohne Verbindung ssid "" mit strength -100.
    expect(signalLevel(-100)).toBe('none');
  });

  test('staffelt gut / ausreichend / schwach', () => {
    expect(signalLevel(-55)).toBe('good');
    expect(signalLevel(-75)).toBe('fair');
    expect(signalLevel(-88)).toBe('weak');
  });
});

describe('updateAvailable', () => {
  test('meldet ein Update nur bei abweichender Version', () => {
    expect(updateAvailable({ version: 'v2.4.6', latest: 'v2.5.0', checkForUpdate: true })).toBe(
      true
    );
    expect(updateAvailable({ version: 'v2.4.6', latest: 'v2.4.6', checkForUpdate: true })).toBe(
      false
    );
  });

  test('schweigt, wenn die Prüfung am Gerät aus ist', () => {
    // Ohne Prüfung steht in `latest` kein belastbarer Wert — dann darf die App
    // kein Update behaupten.
    expect(updateAvailable({ version: 'v2.4.6', latest: 'v2.5.0', checkForUpdate: false })).toBe(
      false
    );
    expect(updateAvailable({ version: 'v2.4.6', latest: '', checkForUpdate: true })).toBe(false);
  });
});

describe('backupFilename', () => {
  test('vermeidet die im Dateinamen verbotenen Doppelpunkte', () => {
    expect(backupFilename(new Date('2026-08-24T09:15:42.123Z'))).toBe(
      'ESPSomfyRTS 2026-08-24T09_15_42.backup'
    );
  });
});
