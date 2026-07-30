import * as fs from 'fs';
import * as path from 'path';

import { parseFrame } from '@/socket/parser';

const capturePath = path.join(__dirname, '..', '..', '..', 'docs', 'api-samples', 'socket-frames.txt');

// Der wichtigste Test im Projekt: der Parser gegen den echten 60-s-Mitschnitt.
describe('parseFrame gegen echten Geräte-Mitschnitt', () => {
  const lines = fs
    .readFileSync(capturePath, 'utf8')
    .split('\n')
    .map((line) => line.replace(/^\[\+[\d.]+s\] /, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('<<'));

  test('Mitschnitt enthält Frames und den Connected-Gruß', () => {
    expect(lines).toContain('Connected');
    expect(lines.filter((l) => l.startsWith('42')).length).toBeGreaterThanOrEqual(5);
  });

  test('der Klartext-String "Connected" ist kein Frame', () => {
    expect(parseFrame('Connected')).toBeNull();
  });

  test('jeder 42-Frame aus dem Mitschnitt parst mit Event-Namen und JSON-Body', () => {
    for (const line of lines) {
      const frame = parseFrame(line);
      if (!line.startsWith('42')) {
        expect(frame).toBeNull();
        continue;
      }
      expect(frame).not.toBeNull();
      expect(frame!.event).toMatch(/^[A-Za-z]+$/);
      expect(typeof frame!.payload).toBe('object');
    }
  });

  test('shadeState-Frames aus dem Mitschnitt tragen die Socket-Feldnamen', () => {
    const shadeFrames = lines
      .map(parseFrame)
      .filter((f): f is NonNullable<typeof f> => f !== null && f.event === 'shadeState');
    expect(shadeFrames.length).toBeGreaterThanOrEqual(2);
    for (const frame of shadeFrames) {
      const payload = frame.payload as Record<string, unknown>;
      // Socket nutzt `type`, nicht `shadeType`; Tilt-Felder fehlen bei tiltType 0.
      expect(payload).toHaveProperty('type');
      expect(payload).not.toHaveProperty('shadeType');
      expect(payload).toHaveProperty('shadeId');
      expect(payload).toHaveProperty('position');
      if (payload.tiltType === 0) {
        expect(payload).not.toHaveProperty('tiltPosition');
      }
    }
  });

  test('erwartete Event-Typen kommen im Mitschnitt vor', () => {
    const events = new Set(lines.map(parseFrame).map((f) => f?.event));
    for (const expected of ['shadeState', 'fwStatus', 'wifiStrength', 'memStatus']) {
      expect(events).toContain(expected);
    }
  });
});

describe('parseFrame Grenzfälle', () => {
  test('ungültiges JSON im Body ergibt null statt Exception', () => {
    expect(parseFrame('42[kaputt,{keinJson]')).toBeNull();
  });

  test('Frames ohne Komma ergeben null', () => {
    expect(parseFrame('42[nurEvent]')).toBeNull();
  });

  test('beliebiger Müll ergibt null', () => {
    expect(parseFrame('garbage')).toBeNull();
    expect(parseFrame('')).toBeNull();
    expect(parseFrame('41[foo,{}]')).toBeNull();
  });

  test('Event-Name wird ohne Anführungszeichen extrahiert', () => {
    const frame = parseFrame('42[shadeState,{"shadeId":7,"position":45}]');
    expect(frame).toEqual({ event: 'shadeState', payload: { shadeId: 7, position: 45 } });
  });

  test('Payload mit verschachtelten Objekten und Kommas parst korrekt', () => {
    const frame = parseFrame('42[fwStatus,{"fwVersion":{"name":"v2.4.6","major":2},"ok":true}]');
    expect(frame!.event).toBe('fwStatus');
    expect((frame!.payload as { fwVersion: { name: string } }).fwVersion.name).toBe('v2.4.6');
  });
});
