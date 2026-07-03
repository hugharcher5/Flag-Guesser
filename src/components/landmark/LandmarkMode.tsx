'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import landmarks, { type Landmark } from '@/data/landmarks';
import { haversineKm } from '@/lib/geo/haversine';
import { saveGameResult } from '@/lib/saveGameResult';

const LandmarkGlobeDisplay = dynamic(
  () => import('./LandmarkGlobeDisplay'),
  { ssr: false },
);

const LANDMARKS_PER_SESSION = 10;

type Phase = 'idle' | 'guessing' | 'revealed' | 'finished';

interface RoundResult {
  landmark: Landmark;
  guessLat: number;
  guessLng: number;
  distanceKm: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

function ScoreBadge({ km }: { km: number }) {
  let color = 'text-red-600 bg-red-50 border-red-200';
  if (km < 100) color = 'text-green-700 bg-green-50 border-green-200';
  else if (km < 500) color = 'text-amber-700 bg-amber-50 border-amber-200';
  else if (km < 1500) color = 'text-orange-700 bg-orange-50 border-orange-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {formatKm(km)}
    </span>
  );
}

export default function LandmarkMode() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [queue, setQueue] = useState<Landmark[]>([]);
  const [index, setIndex] = useState(0);
  const [guessPin, setGuessPin] = useState<{ lat: number; lng: number } | null>(null);
  const [answerPin, setAnswerPin] = useState<{ lat: number; lng: number } | null>(null);
  const [focusCentroid, setFocusCentroid] = useState<{ lat: number; lng: number } | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [currentDist, setCurrentDist] = useState<number | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  const current = queue[index] ?? null;

  useEffect(() => {
    if (!current) return;
    setCurrentImage(null);
    const title = (current.wikiTitle ?? current.name).replace(/ /g, '_');
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const src = d?.thumbnail?.source as string | undefined;
        if (src) setCurrentImage(src.replace(/\/\d+px-/, '/800px-'));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [current]);

  const startGame = useCallback(() => {
    const picked = shuffle(landmarks).slice(0, LANDMARKS_PER_SESSION);
    setQueue(picked);
    setIndex(0);
    setGuessPin(null);
    setAnswerPin(null);
    setFocusCentroid(null);
    setResults([]);
    setCurrentDist(null);
    setPhase('guessing');
  }, []);

  const handleGlobeClick = useCallback((lat: number, lng: number) => {
    if (phase !== 'guessing') return;
    setGuessPin({ lat, lng });
  }, [phase]);

  const handleConfirm = useCallback(() => {
    if (!guessPin || !current || phase !== 'guessing') return;
    const dist = haversineKm(guessPin.lat, guessPin.lng, current.lat, current.lng);
    setCurrentDist(dist);
    setAnswerPin({ lat: current.lat, lng: current.lng });
    setFocusCentroid({ lat: current.lat, lng: current.lng });
    setResults(prev => [...prev, {
      landmark: current,
      guessLat: guessPin.lat,
      guessLng: guessPin.lng,
      distanceKm: dist,
    }]);
    setPhase('revealed');
  }, [guessPin, current, phase]);

  const handleNext = useCallback(() => {
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      setPhase('finished');
      const allResults = [...results];
      const totalDist = allResults.reduce((s, r) => s + r.distanceKm, 0);
      const avgDist = allResults.length > 0 ? totalDist / allResults.length : 0;
      saveGameResult({
        game_mode: 'landmark_guesser',
        score: 0,
        guesses_count: allResults.length,
        correct: false,
        avg_distance_km: avgDist,
      });
    } else {
      setIndex(nextIndex);
      setGuessPin(null);
      setAnswerPin(null);
      setFocusCentroid(null);
      setCurrentDist(null);
      setPhase('guessing');
    }
  }, [index, queue.length, results]);

  const avgKm = useMemo(() => {
    if (results.length === 0) return null;
    return results.reduce((s, r) => s + r.distanceKm, 0) / results.length;
  }, [results]);

  if (phase === 'idle') {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-800">Landmark Guesser</h1>
          <p className="text-sm text-gray-500">
            You&apos;ll see 10 famous landmarks. Place a pin on the globe as close as you can to each one.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full text-left">
          {[
            { emoji: '🏛️', label: '10 landmarks', sub: 'per session' },
            { emoji: '📍', label: 'Click to pin', sub: 'then confirm' },
            { emoji: '📏', label: 'Ranked by', sub: 'avg distance' },
          ].map(({ emoji, label, sub }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-1">
              <span className="text-2xl">{emoji}</span>
              <span className="text-sm font-semibold text-gray-800">{label}</span>
              <span className="text-xs text-gray-400">{sub}</span>
            </div>
          ))}
        </div>
        <button
          onClick={startGame}
          className="w-full py-3 rounded-2xl bg-gray-800 text-white font-semibold text-lg hover:bg-gray-900 transition-colors"
        >
          Start Game
        </button>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-6 flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Results</h2>
          {avgKm !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Average Distance</span>
              <span className="text-3xl font-bold text-gray-800 tabular-nums">{formatKm(avgKm)}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{r.landmark.name}</p>
                  <p className="text-xs text-gray-400 truncate">{r.landmark.city}, {r.landmark.country}</p>
                </div>
                <ScoreBadge km={r.distanceKm} />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={startGame}
          className="w-full py-3 rounded-2xl bg-gray-800 text-white font-semibold hover:bg-gray-900 transition-colors"
        >
          Play Again
        </button>
        <a
          href="/leaderboard/landmark-guesser"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium text-center transition-colors"
        >
          View Leaderboard →
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
        <span>Landmark {index + 1} of {queue.length}</span>
        <div className="flex gap-1">
          {queue.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < index ? 'bg-gray-400' : i === index ? 'bg-gray-800' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Landmark name card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col gap-1">
        {currentImage && (
          <img
            src={currentImage}
            alt={current?.name ?? ''}
            className="w-full h-48 object-cover"
          />
        )}
        {!currentImage && (
          <div className="w-full h-48 bg-gray-100 animate-pulse" />
        )}
        <div className="px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Where is this?</span>
          <h2 className="text-2xl font-bold text-gray-800">{current?.name}</h2>
        </div>
      </div>

      {/* Globe */}
      <LandmarkGlobeDisplay
        guessPin={guessPin}
        answerPin={answerPin}
        onGlobeClick={handleGlobeClick}
        focusCentroid={focusCentroid}
        height={400}
      />

      {/* Result reveal */}
      {phase === 'revealed' && current && currentDist !== null && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your distance</p>
              <p className="text-2xl font-bold text-gray-800">{formatKm(currentDist)}</p>
            </div>
            <ScoreBadge km={currentDist} />
          </div>
          <div className="border-t border-gray-100 pt-2">
            <p className="text-xs text-gray-400">Actual location</p>
            <p className="text-sm font-semibold text-gray-700">{current.city}, {current.country}</p>
          </div>
        </div>
      )}

      {/* Action button */}
      {phase === 'guessing' ? (
        <button
          onClick={handleConfirm}
          disabled={!guessPin}
          className="w-full py-3 rounded-2xl bg-gray-800 text-white font-semibold hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {guessPin ? 'Confirm Guess' : 'Click the globe to place your pin'}
        </button>
      ) : (
        <button
          onClick={handleNext}
          className="w-full py-3 rounded-2xl bg-gray-800 text-white font-semibold hover:bg-gray-900 transition-colors"
        >
          {index + 1 >= queue.length ? 'See Results' : 'Next Landmark →'}
        </button>
      )}
    </div>
  );
}
