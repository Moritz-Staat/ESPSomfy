import { formatAge } from '@/components/ConnectionBar';

const NOW = 1_700_000_000_000;
const ago = (ms: number) => NOW - ms;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatAge', () => {
  it('sagt nichts, wenn noch nie Daten kamen', () => {
    expect(formatAge(null, NOW)).toBeNull();
  });

  it('nennt die erste Minute gerade eben', () => {
    expect(formatAge(ago(0), NOW)).toBe('gerade eben');
    expect(formatAge(ago(59 * SECOND), NOW)).toBe('gerade eben');
  });

  it('rechnet in Minuten, Stunden und Tagen', () => {
    expect(formatAge(ago(MINUTE), NOW)).toBe('vor 1 Min.');
    expect(formatAge(ago(3 * MINUTE), NOW)).toBe('vor 3 Min.');
    expect(formatAge(ago(59 * MINUTE), NOW)).toBe('vor 59 Min.');
    expect(formatAge(ago(HOUR), NOW)).toBe('vor 1 Std.');
    expect(formatAge(ago(23 * HOUR), NOW)).toBe('vor 23 Std.');
    expect(formatAge(ago(DAY), NOW)).toBe('vor einem Tag');
    expect(formatAge(ago(3 * DAY), NOW)).toBe('vor 3 Tagen');
  });

  // Nach einem Neustart kommt der Zeitstempel aus dem Speicher. Geht die Systemuhr
  // in der Zwischenzeit zurueck, darf daraus keine Angabe aus der Zukunft werden.
  it('verschweigt ein Alter in der Zukunft', () => {
    expect(formatAge(NOW + MINUTE, NOW)).toBeNull();
  });
});
