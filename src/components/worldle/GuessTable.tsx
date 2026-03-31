import type { CompassDir } from '@/lib/geo/haversine';
import type { Country } from '@/data/countries';
import CompassIcon from './CompassIcon';

export interface GuessEntry {
  country: Country;
  distanceKm: number;
  compassDir: CompassDir;
  correct: boolean;
}

interface Props {
  guesses: GuessEntry[];
}

/** Renders the list of previous guesses with distance and direction feedback. */
export default function GuessTable({ guesses }: Props) {
  if (guesses.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-2">
      {guesses.map((g, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm
            ${g.correct
              ? 'bg-green-50 border border-green-200'
              : 'bg-white border border-gray-200'
            }`}
        >
          {/* Country name */}
          <span
            className={`flex-1 font-semibold truncate
              ${g.correct ? 'text-green-800' : 'text-gray-800'}`}
          >
            {g.country.name}
          </span>

          {g.correct ? (
            <span className="text-green-700 font-bold text-base">✓</span>
          ) : (
            <div className="flex items-center gap-3 shrink-0 text-gray-500">
              {/* Distance */}
              <span className="font-mono text-xs tabular-nums whitespace-nowrap">
                {g.distanceKm === 0 ? '< 1' : g.distanceKm.toLocaleString()} km
              </span>

              {/* Direction */}
              <div className="flex items-center gap-1 font-semibold text-xs text-gray-700">
                <CompassIcon dir={g.compassDir} size={14} />
                <span>{g.compassDir}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
