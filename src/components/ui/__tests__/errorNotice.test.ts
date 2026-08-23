import { ApiError, TimeoutError } from '@/api/client';
import { describeError } from '@/components/ui/ErrorNotice';

describe('describeError', () => {
  // Die Firmware antwortet englisch und knapp; die bekannten Fälle bekommen einen
  // Text, der sagt, was zu tun ist.
  test('erklärt die Sperre beim Löschen eines gruppierten Rollos', () => {
    const err = new ApiError(
      'This shade is a member of a group and cannot be deleted.',
      400,
      'This shade is a member of a group and cannot be deleted.'
    );
    expect(describeError(err)).toMatch(/Gruppe/);
    expect(describeError(err)).not.toMatch(/member of a group/);
  });

  test('nennt die Höchstzahl bei vollem Speicher', () => {
    const rooms = new ApiError('x', 500, 'Maximum number of rooms exceeded.');
    const groups = new ApiError('x', 500, 'Maximum number of groups exceeded.');
    expect(describeError(rooms)).toMatch(/Räumen/);
    expect(describeError(groups)).toMatch(/Gruppen/);
  });

  test('reicht unbekannte Beschreibungen der Firmware durch', () => {
    expect(describeError(new ApiError('x', 500, 'Something odd happened.'))).toBe(
      'Something odd happened.'
    );
  });

  test('nennt den Status, wenn die Firmware keine Beschreibung liefert', () => {
    expect(describeError(new ApiError('HTTP 500', 500))).toMatch(/HTTP 500/);
  });

  test('unterscheidet Zeitüberschreitung vom Firmware-Fehler', () => {
    expect(describeError(new TimeoutError())).toMatch(/nicht geantwortet/);
  });

  test('fängt alles ab, was kein Error ist', () => {
    expect(describeError('kaputt')).toBe('Unbekannter Fehler.');
    expect(describeError(null)).toBe('Unbekannter Fehler.');
  });
});
