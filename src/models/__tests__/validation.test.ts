import { LIMITS, validateDuration, validateName } from '@/models/index';

describe('validateName', () => {
  test('nimmt gewöhnliche Namen an', () => {
    expect(validateName('Wohnzimmer')).toBeNull();
  });

  test('lehnt leere Namen ab, auch aus reinen Leerzeichen', () => {
    expect(validateName('')).not.toBeNull();
    expect(validateName('   ')).not.toBeNull();
  });

  // char name[21] in Somfy.h: die Firmware schneidet längere Namen still ab.
  test('lehnt ab, was die Firmware abschneiden würde', () => {
    expect(validateName('x'.repeat(LIMITS.maxNameLength))).toBeNull();
    expect(validateName('x'.repeat(LIMITS.maxNameLength + 1))).not.toBeNull();
  });

  test('zählt nach dem Trimmen', () => {
    expect(validateName(`  ${'x'.repeat(LIMITS.maxNameLength)}  `)).toBeNull();
  });
});

describe('validateDuration', () => {
  test('leer bedeutet unverändert', () => {
    expect(validateDuration('')).toBeNull();
  });

  test('nimmt ganze Zahlen an', () => {
    expect(validateDuration('12500')).toBeNull();
  });

  test('lehnt alles andere ab', () => {
    expect(validateDuration('12,5')).not.toBeNull();
    expect(validateDuration('-100')).not.toBeNull();
    expect(validateDuration('abc')).not.toBeNull();
  });
});
