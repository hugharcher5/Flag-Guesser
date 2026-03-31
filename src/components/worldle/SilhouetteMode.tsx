'use client';

import { useState, useEffect, useCallback } from 'react';
import countries from '@/data/countries';
import type { Country } from '@/data/countries';
import { getCountryPolygons, type CountryGeometry } from '@/lib/geo/polygons';
import { calcBorderDistance } from '@/lib/geo/borderCalc';
import SilhouetteDisplay from './SilhouetteDisplay';
import GuessInput from './GuessInput';
import GuessTable, { type GuessEntry } from './GuessTable';

const MAX_GUESSES = 6;

type Phase = 'loading' | 'playing' | 'won' | 'lost';

export default function SilhouetteMode() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');

  // Polygon map: alpha-2 code → geometry (shared across games, never reloaded)
  const [polygons, setPolygons] = useState<Map<string, CountryGeometry> | null>(null);
  // Countries eligible as answers: must have a proper polygon (not a centroid dot)
  const [eligible, setEligible] = useState<Country[]>([]);

  const [answer, setAnswer] = useState<Country | null>(null);
  const [answerGeom, setAnswerGeom] = useState<CountryGeometry | null>(null);
  const [guesses, setGuesses] = useState<GuessEntry[]>([]);

  // Load polygon data once on mount
  useEffect(() => {
    getCountryPolygons()
      .then(polys => {
        const el = countries.filter(c => {
          const g = polys.get(c.code);
          return g !== undefined && !g._dot;
        });
        setPolygons(polys);
        setEligible(el);
        beginGame(polys, el);
      })
      .catch(() => setLoadError('Failed to load country data. Please refresh.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Pick a random answer from the eligible pool and reset game state.
   * Accepts explicit args so it can be called before state has propagated.
   */
  const beginGame = useCallback(
    (polys: Map<string, CountryGeometry>, el: Country[]) => {
      if (el.length === 0) return;
      const picked = el[Math.floor(Math.random() * el.length)];
      setAnswer(picked);
      setAnswerGeom(polys.get(picked.code) ?? null);
      setGuesses([]);
      setPhase('playing');
    },
    [],
  );

  const handlePlayAgain = useCallback(() => {
    if (polygons && eligible.length > 0) beginGame(polygons, eligible);
  }, [polygons, eligible, beginGame]);

  const handleGuess = useCallback(
    (guessed: Country) => {
      if (!answer || !answerGeom || !polygons || phase !== 'playing') return;

      const correct = guessed.code === answer.code;
      let distanceKm = 0;
      let compassDir: GuessEntry['compassDir'] = 'N';

      if (!correct) {
        const guessedGeom = polygons.get(guessed.code);
        if (guessedGeom) {
          const result = calcBorderDistance(guessedGeom, answerGeom);
          distanceKm = result.distanceKm;
          compassDir = result.compassDir;
        }
      }

      const entry: GuessEntry = { country: guessed, distanceKm, compassDir, correct };
      const next = [...guesses, entry];
      setGuesses(next);

      if (correct) {
        setPhase('won');
      } else if (next.length >= MAX_GUESSES) {
        setPhase('lost');
      }
    },
    [answer, answerGeom, polygons, phase, guesses],
  );

  const usedCodes = new Set(guesses.map(g => g.country.code));

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">Silhouette</h1>
        {loadError ? (
          <p className="text-red-600 text-sm text-center">{loadError}</p>
        ) : (
          <>
            <div className="w-full rounded-2xl bg-gray-100 animate-pulse min-h-48 sm:min-h-56" />
            <p className="text-sm text-gray-400">Loading country data…</p>
          </>
        )}
      </div>
    );
  }

  // ── Result (won / lost) ──────────────────────────────────────────────────
  if (phase === 'won' || phase === 'lost') {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-5">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">Silhouette</h1>

        {/* Reveal the silhouette in blue */}
        <SilhouetteDisplay
          geometry={answerGeom}
          revealed
          label={answer?.name ?? 'Country'}
        />

        {/* Result banner */}
        <div
          className={`w-full rounded-xl px-5 py-4 text-center space-y-1
            ${phase === 'won'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
            }`}
        >
          {phase === 'won' ? (
            <>
              <p className="text-xl font-bold">✓ Correct!</p>
              <p className="text-sm">
                You identified{' '}
                <span className="font-semibold">{answer?.name}</span>{' '}
                in{' '}
                <span className="font-semibold">
                  {guesses.length} {guesses.length === 1 ? 'guess' : 'guesses'}
                </span>.
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold">✗ Out of guesses</p>
              <p className="text-sm">
                The answer was{' '}
                <span className="font-semibold">{answer?.name}</span>.
              </p>
            </>
          )}
        </div>

        <GuessTable guesses={guesses} />

        <button
          onClick={handlePlayAgain}
          className="w-full py-3 rounded-xl bg-gray-800 text-white font-semibold text-base
                     hover:bg-gray-900 active:bg-black transition-colors touch-manipulation"
        >
          Play Again
        </button>
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-5">
      {/* Header row */}
      <div className="w-full flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">Silhouette</h1>
        <span className="text-sm text-gray-500">
          {'Guess '}
          <span className="font-semibold text-gray-800">{guesses.length}</span>
          {' / '}
          <span className="font-semibold text-gray-800">{MAX_GUESSES}</span>
        </span>
      </div>

      {/* Country silhouette */}
      <SilhouetteDisplay geometry={answerGeom} label="Hidden country silhouette" />

      {/* Guess input with autocomplete */}
      <GuessInput usedCodes={usedCodes} onGuess={handleGuess} />

      {/* Previous guesses */}
      <GuessTable guesses={guesses} />
    </div>
  );
}
