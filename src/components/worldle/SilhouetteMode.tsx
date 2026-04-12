'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { saveGameResult } from '@/lib/saveGameResult';
import countries from '@/data/countries';
import type { Country } from '@/data/countries';
import { getCountryPolygons, type CountryGeometry } from '@/lib/geo/polygons';
import { calcBorderDistance } from '@/lib/geo/borderCalc';
import { toSvgPath } from '@/lib/geo/project';
import SilhouetteDisplay, { IMAGE_SILHOUETTES } from './SilhouetteDisplay';
import GuessInput from './GuessInput';
import GuessTable, { type GuessEntry } from './GuessTable';

const MAX_GUESSES = 6;

type Phase = 'loading' | 'playing' | 'won' | 'lost';

// ── Test-mode grid ────────────────────────────────────────────────────────────

const TILE_W = 160;
const TILE_H = 100;

function SilhouetteGrid({ polygons }: { polygons: Map<string, CountryGeometry> }) {
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState<'all' | 'dot' | 'real'>('all');

  const tiles = useMemo(() => {
    const q = filter.toLowerCase();
    return countries
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.code.includes(q))
      .map(c => {
        const geom = polygons.get(c.code);
        const isDot = !geom || !!geom._dot;
        return { country: c, geom: geom ?? null, isDot };
      })
      .filter(t => {
        if (highlight === 'dot') return t.isDot;
        if (highlight === 'real') return !t.isDot;
        return true;
      });
  }, [filter, highlight]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="sticky top-0 z-10 bg-gray-50 pb-3 pt-1 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">
            Shape Test Mode
            <span className="ml-2 text-sm font-normal text-gray-400">({tiles.length} shown)</span>
          </h1>
          <span className="text-xs bg-yellow-100 text-yellow-800 border border-yellow-300 rounded px-2 py-0.5 font-mono">
            ?testMode=true
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by name or code…"
            className="flex-1 min-w-40 px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {(['all', 'real', 'dot'] as const).map(v => (
              <button
                key={v}
                onClick={() => setHighlight(v)}
                className={`px-3 py-1.5 capitalize ${highlight === v ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {v === 'dot' ? 'dot-only' : v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_W}px, 1fr))` }}
      >
        {tiles.map(({ country, geom, isDot }) => {
          const hasImageFile = IMAGE_SILHOUETTES.has(country.code);
          const path = !hasImageFile && geom && !isDot
            ? toSvgPath(geom, TILE_W, TILE_H, 8, country.code)
            : '';
          return (
            <div
              key={country.code}
              className={`rounded-xl border bg-white flex flex-col overflow-hidden ${
                isDot ? 'border-red-300' : 'border-gray-200'
              }`}
            >
              <div
                className={`flex items-center justify-center ${isDot ? 'bg-red-50' : 'bg-gray-50'}`}
                style={{ height: TILE_H }}
              >
                {isDot ? (
                  <span className="text-xs text-red-500 font-medium">no polygon</span>
                ) : hasImageFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/silhouettes/${country.code}.svg`}
                    alt={country.name}
                    style={{ width: TILE_W, height: TILE_H, objectFit: 'contain' }}
                  />
                ) : (
                  <svg
                    viewBox={`0 0 ${TILE_W} ${TILE_H}`}
                    width={TILE_W}
                    height={TILE_H}
                    aria-label={country.name}
                  >
                    <path d={path} fill="#1e293b" fillRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="px-2 py-1.5 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-800 truncate">{country.name}</p>
                <p className="text-xs text-gray-400 font-mono">{country.code.toUpperCase()}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  // Detect ?testMode=true after mount (avoids SSR/client hydration mismatch)
  const [testMode, setTestMode] = useState(false);
  useEffect(() => {
    setTestMode(new URLSearchParams(window.location.search).get('testMode') === 'true');
  }, []);

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
        const isTestMode = new URLSearchParams(window.location.search).get('testMode') === 'true';
        if (!isTestMode) beginGame(polys, el);
        else setPhase('playing');
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
        saveGameResult({
          game_mode: 'country_shape_guesser',
          score: (MAX_GUESSES + 1 - next.length) * 100,
          guesses_count: next.length,
          correct: true,
          country_guessed: answer.name,
        });
      } else if (next.length >= MAX_GUESSES) {
        setPhase('lost');
        saveGameResult({
          game_mode: 'country_shape_guesser',
          score: 0,
          guesses_count: next.length,
          correct: false,
          country_guessed: answer.name,
        });
      }
    },
    [answer, answerGeom, polygons, phase, guesses],
  );

  const usedCodes = new Set(guesses.map(g => g.country.code));

  // ── Test mode ─────────────────────────────────────────────────────────────
  if (testMode) {
    if (!polygons) {
      return (
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-800">Shape Test Mode</h1>
          {loadError
            ? <p className="text-red-600 text-sm text-center">{loadError}</p>
            : <p className="text-sm text-gray-400">Loading polygon data…</p>
          }
        </div>
      );
    }
    return <SilhouetteGrid polygons={polygons} />;
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Country Shape Guesser</h1>
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Country Shape Guesser</h1>

        {/* Reveal the silhouette in blue */}
        <SilhouetteDisplay
          geometry={answerGeom}
          code={answer?.code}
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

  const guessesLeft = MAX_GUESSES - guesses.length;

  // ── Playing ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-5">
      {/* Header: title + pip indicators */}
      <div className="w-full flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Country Shape Guesser</h1>
        <div className="flex items-center gap-2">
          {/* 6 pip circles: green = correct, grey = wrong, white = unused */}
          <div className="flex gap-1">
            {Array.from({ length: MAX_GUESSES }).map((_, i) => {
              const g = guesses[i];
              return (
                <span
                  key={i}
                  className={`w-3 h-3 rounded-full border ${
                    !g
                      ? 'bg-white border-gray-300'
                      : g.correct
                      ? 'bg-green-500 border-green-500'
                      : 'bg-gray-400 border-gray-400'
                  }`}
                />
              );
            })}
          </div>
          <span className="text-sm text-gray-500">
            {guessesLeft} {guessesLeft === 1 ? 'guess' : 'guesses'} left
          </span>
        </div>
      </div>

      {/* Country silhouette */}
      <SilhouetteDisplay geometry={answerGeom} code={answer?.code} label="Hidden country silhouette" />

      {/* Guess input with autocomplete */}
      <GuessInput usedCodes={usedCodes} onGuess={handleGuess} />

      {/* Previous guesses */}
      <GuessTable guesses={guesses} />
    </div>
  );
}
