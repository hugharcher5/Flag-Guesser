/**
 * Country name resolution for the Silhouette game mode.
 *
 * Uses the same normalisation logic as fuzzy.ts so behaviour is consistent
 * across the app. Provides two public functions:
 *
 *  - searchCountries(query)  → ranked list for autocomplete dropdown
 *  - resolveCountry(input)   → exact/alias match for submitted guesses
 *
 * Unlike the flag-guesser's isCorrect(), which fuzzy-matches the answer,
 * resolveCountry() requires a strict name/alias match. The autocomplete
 * dropdown is the UX mechanism that guides users to valid inputs.
 */

import countries from '@/data/countries';
import type { Country } from '@/data/countries';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation (matches fuzzy.ts)
    .replace(/\s+/g, ' ');
}

/**
 * Search countries whose name or any alias starts with or contains the query.
 * Results are sorted: starts-with matches first, then substring matches.
 * Already-guessed countries (in `excludeCodes`) are omitted from results.
 */
export function searchCountries(
  query: string,
  excludeCodes: Set<string> = new Set(),
  limit = 8,
): Country[] {
  const q = normalize(query);
  if (!q) return [];

  const sw: Country[] = [];
  const ct: Country[] = [];

  for (const c of countries) {
    if (excludeCodes.has(c.code)) continue;
    const names = [c.name, ...(c.aliases ?? [])].map(normalize);
    if (names.some(n => n.startsWith(q))) sw.push(c);
    else if (names.some(n => n.includes(q))) ct.push(c);
  }

  return [...sw, ...ct].slice(0, limit);
}

/**
 * Resolve a submitted input to exactly one country via name or alias.
 * Returns null if the input doesn't match any country exactly.
 */
export function resolveCountry(input: string): Country | null {
  const q = normalize(input);
  if (!q) return null;
  return (
    countries.find(
      c =>
        normalize(c.name) === q ||
        (c.aliases?.some(a => normalize(a) === q) ?? false),
    ) ?? null
  );
}
