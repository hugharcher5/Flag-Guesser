import countries from '@/data/countries';

/** Converts a 2-letter ISO country code to a flag emoji.
 *  Each letter maps to a Regional Indicator Symbol:
 *  A → 🇦 (U+1F1E6), B → 🇧, … Z → 🇿
 *  So "IE" → 🇮 + 🇪 = 🇮🇪
 */
export function codeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

/** Converts a country display name (e.g. "Ireland") to a flag emoji (e.g. "🇮🇪"). */
export function countryNameToFlag(name: string | null | undefined): string {
  if (!name) return '';
  const code = countries.find((c) => c.name === name)?.code;
  return code ? codeToFlag(code) : '';
}

// Keep old name as alias so existing imports don't break.
export const codeToFlagEmoji = codeToFlag;
