import type { Country } from "@/data/countries";

const THRESHOLD_RATIO = 0.2;
const MAX_DISTANCE = 2;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "") // strip punctuation
    .replace(/\s+/g, " ");       // collapse spaces
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function closeEnough(guess: string, target: string): boolean {
  const g = normalize(guess);
  const t = normalize(target);
  if (g === t) return true;
  const threshold = Math.min(
    Math.max(1, Math.floor(t.length * THRESHOLD_RATIO)),
    MAX_DISTANCE
  );
  if (Math.abs(g.length - t.length) > threshold) return false;
  return levenshtein(g, t) <= threshold;
}

// Smallest edit distance from g to any name/alias of a country.
function bestDist(g: string, c: Country): number {
  const distances = [
    levenshtein(g, normalize(c.name)),
    ...(c.aliases?.map((a) => levenshtein(g, normalize(a))) ?? []),
  ];
  return Math.min(...distances);
}

export function isCorrect(
  guess: string,
  country: Country,
  allCountries: Country[]
): boolean {
  const g = normalize(guess);

  // 1. Exact match against current country → always accept.
  if (g === normalize(country.name)) return true;
  if (country.aliases?.some((a) => normalize(a) === g)) return true;

  // 2. Guess exactly names a different country → always reject.
  //    Prevents "Monaco" being accepted for Indonesia and vice versa.
  if (
    allCountries.some(
      (c) =>
        c.code !== country.code &&
        (normalize(c.name) === g ||
          (c.aliases?.some((a) => normalize(a) === g) ?? false))
    )
  )
    return false;

  // 3. Must fuzzy-match the current country within threshold.
  if (
    !closeEnough(guess, country.name) &&
    !(country.aliases?.some((alias) => closeEnough(guess, alias)))
  )
    return false;

  // 4. Reject if any other country is a STRICTLY closer fuzzy match.
  //    This disambiguates visually identical flags (e.g. Monaco vs Indonesia):
  //    even a near-miss of one country's name won't pass for the other.
  const currentDist = bestDist(g, country);
  return !allCountries.some((c) => {
    if (c.code === country.code) return false;
    return bestDist(g, c) < currentDist;
  });
}
