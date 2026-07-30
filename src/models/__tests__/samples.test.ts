import * as fs from 'fs';
import * as path from 'path';

import {
  DiscoveryResponse,
  ControllerResponse,
  LoginResponse,
  Shade,
  ShadeType,
  TiltType,
  SecurityType,
  hasFavorite,
  normalizeShadeState,
  RawShadeStateEvent,
} from '@/models/index';

const samplesDir = path.join(__dirname, '..', '..', '..', 'docs', 'api-samples');

function loadSample<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8')) as T;
}

describe('Typen gegen echte Geräteantworten (v2.4.6)', () => {
  const discovery = loadSample<DiscoveryResponse>('discovery.json');
  const shades = loadSample<Shade[]>('shades.json');
  const controller = loadSample<ControllerResponse>('controller.json');
  const login = loadSample<LoginResponse>('login.json');

  test('discovery hat Gerätestatus und Bestandslisten', () => {
    expect(discovery.authType).toBe(SecurityType.None);
    expect(typeof discovery.version).toBe('string');
    expect(Array.isArray(discovery.rooms)).toBe(true);
    expect(Array.isArray(discovery.shades)).toBe(true);
    expect(Array.isArray(discovery.groups)).toBe(true);
    expect(discovery.memory.total).toBeGreaterThan(0);
  });

  test('shades nutzen shadeType (nicht type) und liefern Kernfelder', () => {
    expect(shades.length).toBeGreaterThan(0);
    for (const s of shades) {
      expect(typeof s.shadeId).toBe('number');
      expect(s.shadeType).toBe(ShadeType.roller);
      expect(s.tiltType).toBe(TiltType.none);
      expect(typeof s.name).toBe('string');
      expect(s.position).toBeGreaterThanOrEqual(0);
      expect(s.position).toBeLessThanOrEqual(100);
      expect([-1, 0, 1]).toContain(s.direction);
      expect(typeof s.flipPosition).toBe('boolean');
      // Feld heißt in REST-Antworten shadeType — `type` existiert dort nicht.
      expect('type' in s).toBe(false);
    }
  });

  test('myPos -1 vom echten Gerät bedeutet „kein Favorit"', () => {
    for (const s of shades) {
      expect(s.myPos).toBe(-1);
      expect(hasFavorite(s.myPos)).toBe(false);
    }
    expect(hasFavorite(255)).toBe(false);
    expect(hasFavorite(50)).toBe(true);
    expect(hasFavorite(0)).toBe(true);
    expect(hasFavorite(100)).toBe(true);
  });

  test('controller bestätigt Systemgrenzen', () => {
    expect(controller.maxShades).toBe(32);
    expect(controller.maxGroups).toBe(16);
    expect(controller.maxRooms).toBe(16);
    expect(controller.maxGroupedShades).toBe(32);
    expect(controller.maxLinkedRemotes).toBe(7);
  });

  test('login liefert Token auch ohne Sicherung', () => {
    expect(login.success).toBe(true);
    expect(login.type).toBe(SecurityType.None);
    expect(login.apiKey).toMatch(/^[0-9a-f]{64}$/);
  });

  test('normalizeShadeState mappt type → shadeType (Frame aus Mitschnitt)', () => {
    const raw: RawShadeStateEvent = {
      shadeId: 1,
      type: 0,
      remoteAddress: 100001,
      name: 'Wohnzimmer',
      direction: 0,
      position: 0,
      target: 0,
      myPos: -1,
      tiltType: 0,
      flipCommands: false,
      flipPosition: false,
      flags: 0,
      sunSensor: false,
      light: false,
      sortOrder: 3,
    };
    const patch = normalizeShadeState(raw);
    expect(patch.shadeType).toBe(ShadeType.roller);
    expect('type' in patch).toBe(false);
    expect(patch.tiltPosition).toBeUndefined();
  });
});
