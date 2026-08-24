import { CHART_BARS, recentSamples, spanMinutes } from '@/components/RssiChart';
import { WifiSample } from '@/models/index';

const sample = (at: number, strength = -50): WifiSample => ({ at, strength });

describe('recentSamples', () => {
  test('lässt kurze Verläufe unangetastet', () => {
    const history = [sample(1), sample(2)];
    expect(recentSamples(history)).toBe(history);
  });

  test('zeigt das jüngste Ende, nicht den Anfang', () => {
    const history = Array.from({ length: CHART_BARS + 10 }, (_, i) => sample(i));
    const shown = recentSamples(history);
    expect(shown).toHaveLength(CHART_BARS);
    expect(shown[shown.length - 1].at).toBe(CHART_BARS + 9);
  });
});

describe('spanMinutes', () => {
  test('braucht mindestens zwei Messpunkte', () => {
    expect(spanMinutes([])).toBe(0);
    expect(spanMinutes([sample(0)])).toBe(0);
  });

  test('rundet auf ganze Minuten, aber nie auf null', () => {
    const start = Date.now();
    expect(spanMinutes([sample(start), sample(start + 5 * 60_000)])).toBe(5);
    // Ein Verlauf von wenigen Sekunden ist trotzdem einer — „letzte 0 Min" wäre Unsinn.
    expect(spanMinutes([sample(start), sample(start + 4_000)])).toBe(1);
  });
});
