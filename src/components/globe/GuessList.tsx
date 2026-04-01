import type { Country } from '@/data/countries';

export interface GlobeGuessEntry {
  country: Country;
  distanceKm: number;
  guessNumber: number;
  color: string;
  correct: boolean;
}

interface Props {
  guesses: GlobeGuessEntry[];
}

/**
 * Scrollable guess list sorted by nearest-border distance (closest at top).
 * Rank 1 = closest to the answer so far.
 */
export default function GuessList({ guesses }: Props) {
  if (guesses.length === 0) return null;

  const sorted = [...guesses].sort((a, b) => a.distanceKm - b.distanceKm);

  return (
    <div className="w-full divide-y divide-gray-100 rounded-xl overflow-hidden border border-gray-200 bg-white">
      {sorted.map((g, rank) => (
        <div
          key={g.country.code}
          className={`flex items-center gap-2.5 px-3 py-2.5
            ${g.correct ? 'bg-green-50' : ''}`}
        >
          {/* Rank */}
          <span className="w-6 text-sm font-bold text-gray-400 shrink-0 text-right">
            {rank + 1}
          </span>

          {/* Flag */}
          <img
            src={`https://flagcdn.com/w40/${g.country.code}.png`}
            alt={g.country.name}
            width={28}
            height={20}
            className="rounded shrink-0 object-cover"
            style={{ height: 20 }}
          />

          {/* Country name */}
          <span
            className={`flex-1 text-sm font-semibold truncate
              ${g.correct ? 'text-green-800' : 'text-gray-800'}`}
          >
            {g.country.name}
          </span>

          {/* Guess number */}
          <span className="font-mono text-xs text-gray-400 font-normal shrink-0 whitespace-nowrap">
            Guess {g.guessNumber}
          </span>

          {/* Distance / tick */}
          {g.correct ? (
            <span className="text-green-700 font-bold text-base shrink-0">✓</span>
          ) : (
            <span className="font-mono text-sm text-gray-600 tabular-nums whitespace-nowrap shrink-0">
              {g.distanceKm === 0 ? '< 1' : g.distanceKm.toLocaleString()} km
            </span>
          )}

          {/* Colour swatch */}
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white shadow-sm"
            style={{ background: g.color }}
          />
        </div>
      ))}
    </div>
  );
}
