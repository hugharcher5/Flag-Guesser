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
    <div className="w-full flex flex-col gap-1.5">
      {sorted.map((g, rank) => (
        <div
          key={g.country.code}
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm
            ${g.correct
              ? 'bg-green-50 border border-green-200'
              : rank % 2 === 0
              ? 'bg-white border border-gray-200'
              : 'bg-gray-50 border border-gray-200'
            }`}
        >
          {/* Rank */}
          <span className="w-5 text-xs font-mono text-gray-400 shrink-0 text-right">
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
            className={`flex-1 font-semibold truncate
              ${g.correct ? 'text-green-800' : 'text-gray-800'}`}
          >
            {g.country.name}
          </span>

          {/* Guess number */}
          <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
            #{g.guessNumber}
          </span>

          {/* Distance */}
          {g.correct ? (
            <span className="text-green-700 font-bold text-base shrink-0">✓</span>
          ) : (
            <span className="font-mono text-xs tabular-nums whitespace-nowrap text-gray-500 shrink-0">
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
