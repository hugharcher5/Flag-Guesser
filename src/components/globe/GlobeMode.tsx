'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import countries from '@/data/countries';
import type { Country } from '@/data/countries';
import { getCountryPolygons, type CountryGeometry } from '@/lib/geo/polygons';
import { calcBorderDistance } from '@/lib/geo/borderCalc';
import { getCountryColor } from '@/lib/globe/colorScale';
import GlobeInput from './GlobeInput';
import GuessList, { type GlobeGuessEntry } from './GuessList';
import MagnifyOverlay from './MagnifyOverlay';

// Three.js / react-globe.gl must not run on the server
const GlobeDisplay = dynamic(() => import('./GlobeDisplay'), { ssr: false });

type Phase = 'loading' | 'playing' | 'won';

export default function GlobeMode() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [polygons, setPolygons] = useState<Map<string, CountryGeometry> | null>(null);
  const [eligible, setEligible] = useState<Country[]>([]);
  const [answer, setAnswer] = useState<Country | null>(null);
  const [guesses, setGuesses] = useState<GlobeGuessEntry[]>([]);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Load polygon data once
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

  const beginGame = useCallback(
    (polys: Map<string, CountryGeometry>, el: Country[]) => {
      if (el.length === 0) return;
      const picked = el[Math.floor(Math.random() * el.length)];
      setAnswer(picked);
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
      if (!answer || !polygons || phase !== 'playing') return;

      const correct = guessed.code === answer.code;

      const guessedGeom = polygons.get(guessed.code);
      const answerGeom = polygons.get(answer.code);

      let distanceKm = 0;
      if (!correct && guessedGeom && answerGeom) {
        const result = calcBorderDistance(guessedGeom, answerGeom);
        distanceKm = result.distanceKm;
      }

      const guessNum = guesses.length + 1;
      const color = getCountryColor(distanceKm, correct);

      const entry: GlobeGuessEntry = {
        country: guessed,
        distanceKm,
        guessNumber: guessNum,
        color,
        correct,
      };

      setGuesses(prev => [...prev, entry]);
      if (correct) setPhase('won');
    },
    [answer, polygons, phase, guesses.length],
  );

  const handleHover = useCallback(
    (code: string | null, pos: { x: number; y: number } | null) => {
      setHoveredCode(code);
      setHoverPos(pos);
    },
    [],
  );

  // Derived maps for GlobeDisplay and MagnifyOverlay
  const guessColors = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of guesses) m.set(g.country.code, g.color);
    return m;
  }, [guesses]);

  const guessDistances = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guesses) m.set(g.country.code, g.distanceKm);
    return m;
  }, [guesses]);

  const countryNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of countries) m.set(c.code, c.name);
    return m;
  }, []);

  const usedCodes = useMemo(
    () => new Set(guesses.map(g => g.country.code)),
    [guesses],
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="w-full max-w-2xl flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Globe Guesser</h1>
        {loadError ? (
          <p className="text-red-600 text-sm text-center">{loadError}</p>
        ) : (
          <>
            <div className="w-full rounded-2xl bg-gray-100 animate-pulse" style={{ height: 440 }} />
            <p className="text-sm text-gray-400">Loading country data…</p>
          </>
        )}
      </div>
    );
  }

  // ── Layout (playing + won) ────────────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-4">
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-800">Globe Guesser</h1>
        <span className="text-sm text-gray-500">
          {guesses.length} {guesses.length === 1 ? 'guess' : 'guesses'}
        </span>
      </div>

      {/* Globe + magnifier overlay wrapper */}
      {polygons && (
        <div className="relative w-full">
          <GlobeDisplay
            polygons={polygons}
            guessColors={guessColors}
            onCountryHover={handleHover}
            height={440}
          />
          <MagnifyOverlay
            hoveredCode={hoveredCode}
            screenPos={hoverPos}
            polygons={polygons}
            guessColors={guessColors}
            guessDistances={guessDistances}
            countryNames={countryNames}
          />
        </div>
      )}

      {/* Win overlay */}
      {phase === 'won' && (
        <div className="w-full rounded-xl px-5 py-5 text-center space-y-3 bg-green-50 border border-green-200">
          <p className="text-xl font-bold text-green-800">
            You got it in {guesses.length} {guesses.length === 1 ? 'guess' : 'guesses'}!
          </p>
          <p className="text-sm text-green-700">
            The answer was <span className="font-semibold">{answer?.name}</span>.
          </p>
          <button
            onClick={handlePlayAgain}
            className="mt-1 w-full py-3 rounded-xl bg-gray-800 text-white font-semibold text-base
                       hover:bg-gray-900 active:bg-black transition-colors touch-manipulation"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Guess input (hidden after winning) */}
      {phase === 'playing' && (
        <div className="w-full max-w-md">
          <GlobeInput usedCodes={usedCodes} onGuess={handleGuess} />
        </div>
      )}

      {/* Guess list */}
      {guesses.length > 0 && (
        <div className="w-full max-w-md">
          <GuessList guesses={guesses} />
        </div>
      )}
    </div>
  );
}
