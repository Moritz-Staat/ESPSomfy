import {
  normalizeShadeState,
  RawShadeStateEvent,
  Shade,
  ShadeType,
  TiltType,
} from '@/models/index';

// Fixture mit allen 17 Shade-Typen und allen 5 Tilt-Typen.
export function buildShadeFixture(): Shade[] {
  const shadeTypes = Object.values(ShadeType).filter((v): v is ShadeType => typeof v === 'number');
  const tiltTypes = Object.values(TiltType).filter((v): v is TiltType => typeof v === 'number');
  return shadeTypes.map((shadeType, i) => {
    const tiltType = tiltTypes[i % tiltTypes.length];
    const shade: Shade = {
      shadeId: i + 1,
      shadeType,
      remoteAddress: 100000 + i,
      name: `Fixture ${ShadeType[shadeType]}`,
      direction: 0,
      position: (i * 7) % 101,
      target: (i * 7) % 101,
      myPos: i % 2 === 0 ? -1 : 50,
      tiltType,
      flipCommands: i % 3 === 0,
      flipPosition: i % 4 === 0,
      flags: 0,
      sunSensor: false,
      light: false,
      sortOrder: i,
    };
    if (tiltType !== TiltType.none) {
      shade.tiltDirection = 0;
      shade.tiltTarget = 25;
      shade.tiltPosition = 25;
      shade.myTiltPos = -1;
    }
    return shade;
  });
}

describe('Enum-Mappings', () => {
  test('alle 17 Shade-Typen sind abgebildet (0–16)', () => {
    const values = Object.values(ShadeType).filter((v) => typeof v === 'number') as number[];
    expect(values).toHaveLength(17);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(16);
    expect(ShadeType.roller).toBe(0);
    expect(ShadeType.drycontact).toBe(9);
    expect(ShadeType.rgate1).toBe(16);
  });

  test('alle 5 Tilt-Typen sind abgebildet (0–4)', () => {
    const values = Object.values(TiltType).filter((v) => typeof v === 'number') as number[];
    expect(values).toHaveLength(5);
    expect(TiltType.none).toBe(0);
    expect(TiltType.euromode).toBe(4);
  });

  test('Fixture deckt alle Shade- und Tilt-Typen ab', () => {
    const fixture = buildShadeFixture();
    expect(new Set(fixture.map((s) => s.shadeType)).size).toBe(17);
    expect(new Set(fixture.map((s) => s.tiltType)).size).toBe(5);
  });
});

describe('flipPosition / flipCommands', () => {
  test('Positionswerte werden NIE erneut gespiegelt — die Firmware hat transformPosition bereits angewendet', () => {
    const raw: RawShadeStateEvent = {
      shadeId: 5,
      type: ShadeType.roller,
      remoteAddress: 571241,
      name: 'Geflippt',
      direction: 0,
      position: 70,
      target: 70,
      myPos: 30,
      tiltType: TiltType.none,
      flipCommands: true,
      flipPosition: true,
      flags: 0,
      sunSensor: false,
      light: false,
      sortOrder: 1,
    };
    const patch = normalizeShadeState(raw);
    // Werte kommen bereits gespiegelt an und müssen unverändert durchgereicht werden.
    expect(patch.position).toBe(70);
    expect(patch.target).toBe(70);
    expect(patch.myPos).toBe(30);
    expect(patch.flipPosition).toBe(true);
    expect(patch.flipCommands).toBe(true);
  });

  test('Tilt-Felder bleiben beim Normalisieren erhalten, wenn vorhanden', () => {
    const fixture = buildShadeFixture().find((s) => s.tiltType !== TiltType.none)!;
    const raw: RawShadeStateEvent = {
      shadeId: fixture.shadeId,
      type: fixture.shadeType,
      remoteAddress: fixture.remoteAddress,
      name: fixture.name,
      direction: 0,
      position: 10,
      target: 10,
      myPos: -1,
      tiltType: fixture.tiltType,
      flipCommands: false,
      flipPosition: false,
      flags: 0,
      sunSensor: false,
      light: false,
      sortOrder: 0,
      tiltDirection: 1,
      tiltTarget: 80,
      tiltPosition: 40,
      myTiltPos: 60,
    };
    const patch = normalizeShadeState(raw);
    expect(patch.tiltDirection).toBe(1);
    expect(patch.tiltTarget).toBe(80);
    expect(patch.tiltPosition).toBe(40);
    expect(patch.myTiltPos).toBe(60);
  });
});
