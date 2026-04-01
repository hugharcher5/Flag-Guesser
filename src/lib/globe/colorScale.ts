/**
 * Maps a nearest-border distance (km) to a hex colour for the Globe Guesser heat map.
 *
 * Scale (non-correct guesses):
 *   0 km   → deep red   (adjacent / bordering)
 *   6 000  → orange
 *   12 000 → yellow
 *   20 000 → white      (antipodal)
 *
 * Correct guess: always green (#22c55e).
 */

export function getCountryColor(distanceKm: number, isCorrect: boolean): string {
  if (isCorrect) return '#22c55e';

  const d = Math.max(0, Math.min(20_000, distanceKm));
  const t = d / 20_000; // 0 = closest, 1 = farthest

  let h: number, s: number, l: number;

  if (t < 0.3) {
    // deep red → orange (0–6 000 km)
    const p = t / 0.3;
    h = p * 20;           // 0 → 20
    s = 85 + p * 15;      // 85% → 100%
    l = 35 + p * 20;      // 35% → 55%
  } else if (t < 0.6) {
    // orange → yellow (6 000–12 000 km)
    const p = (t - 0.3) / 0.3;
    h = 20 + p * 34;      // 20 → 54
    s = 100;
    l = 55 - p * 5;       // 55% → 50%
  } else {
    // yellow → white (12 000–20 000 km)
    const p = (t - 0.6) / 0.4;
    h = 54;
    s = 100 - p * 100;    // 100% → 0%
    l = 50 + p * 50;      // 50% → 100%
  }

  return hslToHex(h, s, l);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
