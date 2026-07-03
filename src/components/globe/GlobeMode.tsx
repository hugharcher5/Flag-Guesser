'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import countries from '@/data/countries';
import type { Country } from '@/data/countries';
import { getCountryPolygons, type CountryGeometry } from '@/lib/geo/polygons';
import { calcBorderDistance } from '@/lib/geo/borderCalc';
import { getCountryColor } from '@/lib/globe/colorScale';
import { SMALL_COUNTRY_CODES } from './MagnifyOverlay';
import { saveGameResult } from '@/lib/saveGameResult';
import GlobeInput from './GlobeInput';
import GuessList, { type GlobeGuessEntry } from './GuessList';
import MagnifyOverlay from './MagnifyOverlay';
import type { GuessedPolygon } from './GlobeDisplay';

// MapLibre GL must not run on the server
const GlobeDisplay = dynamic(() => import('./GlobeDisplay'), { ssr: false });

type Phase = 'loading' | 'playing' | 'won';

/**
 * Try to fetch the lighter 50m polygon file for the globe (faster load).
 * Falls back to the full 10m file if 50m is not yet generated.
 */
async function getGlobePolygons(): Promise<Map<string, CountryGeometry>> {
  try {
    const res = await fetch('/countryPolygons50m.json');
    if (!res.ok) throw new Error('50m not available');
    const raw = (await res.json()) as Record<string, CountryGeometry>;
    return new Map(Object.entries(raw));
  } catch {
    return getCountryPolygons();
  }
}

/** Returns the geographic centroid of a CountryGeometry as { lat, lng }. */
function geomCentroid(geom: CountryGeometry): { lat: number; lng: number } {
  let sumLng = 0, sumLat = 0, count = 0;
  const addRing = (ring: [number, number][]) => {
    for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat; count++; }
  };
  if (geom.type === 'Polygon') {
    addRing(geom.coordinates[0] as [number, number][]);
  } else {
    let best: [number, number][] = [];
    for (const poly of geom.coordinates) {
      const outer = poly[0] as [number, number][];
      if (outer.length > best.length) best = outer;
    }
    addRing(best);
  }
  return { lat: count > 0 ? sumLat / count : 0, lng: count > 0 ? sumLng / count : 0 };
}

export default function GlobeMode() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [polygons, setPolygons] = useState<Map<string, CountryGeometry> | null>(null);
  const [eligible, setEligible] = useState<Country[]>([]);
  const [answer, setAnswer] = useState<Country | null>(null);
  const [guesses, setGuesses] = useState<GlobeGuessEntry[]>([]);

  // ── Globe rotation focus ─────────────────────────────────────────────────────
  // Set to a new object on each guess to trigger GlobeDisplay's rotation effect.
  const [focusCentroid, setFocusCentroid] = useState<{ lat: number; lng: number } | null>(null);

  // ── Magnifier state ──────────────────────────────────────────────────────────
  // Single source of truth for what the magnifier shows. Updated by both hover
  // events (interactive) and auto-show logic (post-guess for small countries).
  const [magnifierCode, setMagnifierCode] = useState<string | null>(null);
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number } | null>(null);

  // Whether the currently shown magnifier was triggered automatically (not by hover).
  // Used to decide if globe mouse-movement should dismiss it.
  const magnifierIsAutoRef = useRef(false);
  // Auto-hide timer handle
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Code of the small country waiting for the rotation animation to complete
  const pendingSmallCodeRef = useRef<string | null>(null);

  const clearAutoHide = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  // ── Load 50m polygon data once ───────────────────────────────────────────────
  useEffect(() => {
    getGlobePolygons()
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
      setFocusCentroid(null);
      clearAutoHide();
      magnifierIsAutoRef.current = false;
      pendingSmallCodeRef.current = null;
      setMagnifierCode(null);
      setMagnifierPos(null);
      setPhase('playing');
    },
    [clearAutoHide],
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

      setGuesses(prev => [
        ...prev,
        { country: guessed, distanceKm, guessNumber: guessNum, color, correct },
      ]);

      if (correct) {
        setPhase('won');
        saveGameResult({
          game_mode: 'globe_guesser',
          guesses_count: guesses.length + 1,
          correct: true,
          country_guessed: answer.name,
        });
      }

      // Rotate globe to guessed country centroid
      if (guessedGeom) {
        setFocusCentroid(geomCentroid(guessedGeom));
      }

      // Queue auto-magnifier if the guessed country is small
      pendingSmallCodeRef.current = SMALL_COUNTRY_CODES.has(guessed.code)
        ? guessed.code
        : null;
    },
    [answer, polygons, phase, guesses.length],
  );

  // ── Called by GlobeDisplay after the 1-second rotation animation settles ────
  const handleFocusComplete = useCallback(
    (pos: { x: number; y: number }) => {
      const code = pendingSmallCodeRef.current;
      if (!code) return; // no small country was pending

      pendingSmallCodeRef.current = null;
      clearAutoHide();
      magnifierIsAutoRef.current = true;
      setMagnifierCode(code);
      setMagnifierPos(pos);

      // Auto-hide after 4 seconds
      autoHideTimerRef.current = setTimeout(() => {
        magnifierIsAutoRef.current = false;
        setMagnifierCode(null);
        setMagnifierPos(null);
      }, 4000);
    },
    [clearAutoHide],
  );

  // ── Called by GlobeDisplay on any mouse movement over the canvas ─────────────
  const handleGlobeMouseMove = useCallback(() => {
    if (!magnifierIsAutoRef.current) return; // hover-driven magnifier: leave it alone
    clearAutoHide();
    magnifierIsAutoRef.current = false;
    setMagnifierCode(null);
    setMagnifierPos(null);
  }, [clearAutoHide]);

  // ── Hover events from GlobeDisplay (mouse over/off small guessed polygons) ───
  const handleCountryHover = useCallback(
    (code: string | null, pos: { x: number; y: number } | null) => {
      // Hover always overrides (including clearing) the auto-shown magnifier
      clearAutoHide();
      magnifierIsAutoRef.current = false;
      pendingSmallCodeRef.current = null;
      setMagnifierCode(code);
      setMagnifierPos(pos);
    },
    [clearAutoHide],
  );

  // ── Derived data ─────────────────────────────────────────────────────────────
  const guessedPolygons = useMemo<GuessedPolygon[]>(() => {
    if (!polygons) return [];
    return guesses.flatMap(g => {
      const geom = polygons.get(g.country.code);
      if (!geom || geom._dot) return [];
      return [{ code: g.country.code, geom, color: g.color }];
    });
  }, [guesses, polygons]);

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
            guessedPolygons={guessedPolygons}
            onCountryHover={handleCountryHover}
            focusCentroid={focusCentroid}
            onFocusComplete={handleFocusComplete}
            onGlobeMouseMove={handleGlobeMouseMove}
            height={440}
          />
          <MagnifyOverlay
            hoveredCode={magnifierCode}
            screenPos={magnifierPos}
            polygons={polygons}
            guessColors={guessColors}
            guessDistances={guessDistances}
            countryNames={countryNames}
          />
        </div>
      )}

      {/* Win banner */}
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
