"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import countries from "@/data/countries";
import capitals from "@/data/capitals";
import type { Country } from "@/data/countries";
import type { Capital } from "@/data/capitals";
import { isCapitalCorrect } from "@/lib/fuzzy";
import { getRecords, updateRecords, CAPITAL_STORAGE_KEY } from "@/lib/storage";
import { saveGameResult } from "@/lib/saveGameResult";
import type { SpeedQuizRecords } from "@/lib/storage";
import { getCountryPolygons, type CountryGeometry } from "@/lib/geo/polygons";
import { toSvgPath, projectPointOnSilhouette } from "@/lib/geo/project";
import { SILHOUETTE_PATHS } from "@/lib/geo/silhouettePaths";

const QUIZ_DURATION_S = 900;

type Phase = "loading" | "idle" | "running" | "finished";

interface FinishedData {
  correctCount: number;
  elapsedMs: number;
  completedAll: boolean;
  isNewBestScore: boolean;
  isNewFastestCompletion: boolean;
}

interface CountryWithCapital {
  country: Country;
  capital: Capital;
  geometry: CountryGeometry;
}

const SVG_W = 480;
const SVG_H = 320;
const SVG_PAD = 16;

const IMAGE_SILHOUETTES = new Set([
  "mc", "va", "nr", "sg", "sm", "mh", "mv", "fm", "tv",
]);

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatMs(ms: number): string {
  return formatSeconds(Math.floor(ms / 1000));
}

function computeContinentBreakdown(
  seenCodes: Set<string>,
  correctCodes: Set<string>,
): Record<string, { correct: number; seen: number }> {
  const codeToContinent = new Map(countries.map((c) => [c.code, c.continent]));
  const bd: Record<string, { correct: number; seen: number }> = {};
  for (const code of seenCodes) {
    const cont = codeToContinent.get(code);
    if (!cont) continue;
    if (!bd[cont]) bd[cont] = { correct: 0, seen: 0 };
    bd[cont].seen++;
    if (correctCodes.has(code)) bd[cont].correct++;
  }
  return bd;
}

function CapitalDisplay({
  entry,
}: {
  entry: CountryWithCapital;
}) {
  const useImage = IMAGE_SILHOUETTES.has(entry.country.code);

  const pathData = useMemo(() => {
    if (useImage) return "";
    const pre = SILHOUETTE_PATHS[entry.country.code];
    if (pre) return pre;
    return toSvgPath(entry.geometry, SVG_W, SVG_H, SVG_PAD, entry.country.code);
  }, [entry.geometry, entry.country.code, useImage]);

  const capitalPoint = useMemo(() => {
    if (useImage) return null;
    return projectPointOnSilhouette(
      entry.geometry,
      SVG_W,
      SVG_H,
      SVG_PAD,
      entry.country.code,
      entry.capital.lng,
      entry.capital.lat,
    );
  }, [entry.geometry, entry.country.code, entry.capital.lng, entry.capital.lat, useImage]);

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div className="w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white flex items-center justify-center min-h-32 sm:min-h-40 p-3">
        {useImage ? (
          <div className="relative w-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/silhouettes/${entry.country.code}.svg`}
              alt="Country silhouette"
              className="w-full max-h-48 sm:max-h-64 object-contain"
            />
            <div
              className="absolute w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-md"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            />
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full max-h-48 sm:max-h-64"
            aria-label="Country silhouette"
          >
            <path d={pathData} fill="#1e293b" fillRule="evenodd" />
            {capitalPoint && (
              <circle
                cx={capitalPoint.x}
                cy={capitalPoint.y}
                r={6}
                fill="#ef4444"
                stroke="white"
                strokeWidth={2}
              />
            )}
          </svg>
        )}
      </div>
      <p className="text-lg font-bold text-gray-800 text-center">
        {entry.country.name}
      </p>
    </div>
  );
}

interface MissedItem {
  code: string;
  label: string;
  sublabel?: string;
  flagUrl?: string;
}

function MissedAnswersSection({ items }: { items: MissedItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700">
          Missed Answers ({items.length})
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {items.map((item) => (
            <div key={item.code} className="flex items-center gap-3 px-5 py-3">
              {item.flagUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.flagUrl}
                  alt=""
                  className="w-8 h-auto rounded-sm shrink-0 shadow-sm"
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="text-xs text-gray-400 truncate">{item.sublabel}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CapitalGuesserMode() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [entries, setEntries] = useState<CountryWithCapital[]>([]);
  const [queue, setQueue] = useState<CountryWithCapital[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(QUIZ_DURATION_S);
  const [guess, setGuess] = useState("");
  const [finished, setFinished] = useState<FinishedData | null>(null);
  const [records, setRecords] = useState<SpeedQuizRecords>({
    bestScore: 0,
    fastestCompletion: null,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const correctCountRef = useRef(0);
  const phaseRef = useRef<Phase>("loading");
  const hasFinishedRef = useRef(false);
  const seenCodesRef = useRef<Set<string>>(new Set());
  const correctCodesRef = useRef<Set<string>>(new Set());

  const allCapitals = useMemo(
    () => entries.map((e) => e.capital),
    [entries],
  );

  const total = entries.length;
  const current = phase === "running" ? (queue[0] ?? null) : null;

  useEffect(() => {
    setRecords(getRecords(CAPITAL_STORAGE_KEY));
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    getCountryPolygons().then((polyMap) => {
      const built: CountryWithCapital[] = [];
      for (const c of countries) {
        const cap = capitals[c.code];
        const geom = polyMap.get(c.code);
        if (cap && geom) {
          built.push({ country: c, capital: cap, geometry: geom });
        }
      }
      setEntries(built);
      setPhase("idle");
    });
  }, []);

  const currentCode = current?.country.code ?? null;
  useEffect(() => {
    if (phase === "running") {
      inputRef.current?.focus();
      if (currentCode) seenCodesRef.current.add(currentCode);
    }
  }, [phase, currentCode]);

  const finishQuiz = useCallback((completedAll: boolean) => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    phaseRef.current = "finished";

    const elapsedMs = Math.min(
      Date.now() - startTimeRef.current,
      QUIZ_DURATION_S * 1000,
    );
    const finalCorrect = correctCountRef.current;

    const { records: newRecords, isNewBestScore, isNewFastestCompletion } =
      updateRecords(finalCorrect, completedAll ? elapsedMs : null, CAPITAL_STORAGE_KEY);

    setRecords(newRecords);
    setFinished({
      correctCount: finalCorrect,
      elapsedMs,
      completedAll,
      isNewBestScore,
      isNewFastestCompletion,
    });
    setPhase("finished");
    saveGameResult({
      game_mode: "capital_guesser",
      score: finalCorrect,
      guesses_count: total,
      correct: completedAll,
      completion_time: Math.floor(elapsedMs / 1000),
      continent_breakdown: computeContinentBreakdown(
        seenCodesRef.current,
        correctCodesRef.current,
      ),
    });
  }, [total]);

  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(
        0,
        QUIZ_DURATION_S - Math.floor(elapsed / 1000),
      );
      setTimeRemaining(remaining);
      if (remaining === 0) {
        finishQuiz(false);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [phase, finishQuiz]);

  const startQuiz = useCallback(() => {
    correctCountRef.current = 0;
    hasFinishedRef.current = false;
    startTimeRef.current = Date.now();
    seenCodesRef.current = new Set();
    correctCodesRef.current = new Set();
    setQueue(shuffled([...entries]));
    setCorrectCount(0);
    setTimeRemaining(QUIZ_DURATION_S);
    setGuess("");
    setFinished(null);
    setPhase("running");
  }, [entries]);

  const handleGuessChange = useCallback(
    (value: string) => {
      setGuess(value);
      if (!current || !value.trim()) return;

      if (isCapitalCorrect(value, current.capital, allCapitals)) {
        correctCodesRef.current.add(current.country.code);
        const newCount = correctCountRef.current + 1;
        correctCountRef.current = newCount;
        setCorrectCount(newCount);

        if (newCount === total) {
          finishQuiz(true);
        } else {
          setQueue((q) => q.slice(1));
          setGuess("");
        }
      }
    },
    [current, finishQuiz, allCapitals, total],
  );

  const handleSkip = useCallback(() => {
    setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
    setGuess("");
  }, []);

  const timerColour =
    timeRemaining > 120
      ? "text-gray-800"
      : timeRemaining > 60
        ? "text-amber-600"
        : "text-red-600";

  // ══════════════════════════════════════════════════════════════════════
  // LOADING
  // ══════════════════════════════════════════════════════════════════════
  if (phase === "loading") {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">
          Capital Guesser
        </h1>
        <p className="text-gray-500 text-sm">Loading country shapes...</p>
        <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // START SCREEN
  // ══════════════════════════════════════════════════════════════════════
  if (phase === "idle") {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">
          Capital Guesser
        </h1>

        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
          Name the capital of all{" "}
          <span className="font-semibold text-gray-700">
            {total} countries
          </span>{" "}
          as fast as you can. You have{" "}
          <span className="font-semibold text-gray-700">15 minutes</span>.
          You&apos;ll see the country shape with a red dot marking the capital.
          Answers are checked as you type. Skip to come back later.
        </p>

        <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 flex flex-col gap-3 text-left">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Personal Bests
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Best score</span>
            <span className="font-semibold text-gray-800">
              {records.bestScore > 0
                ? `${records.bestScore} / ${total}`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Fastest completion</span>
            <span className="font-semibold text-gray-800">
              {records.fastestCompletion !== null
                ? formatMs(records.fastestCompletion)
                : "—"}
            </span>
          </div>
        </div>

        <button
          onClick={startQuiz}
          className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg
                     hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RESULTS SCREEN
  // ══════════════════════════════════════════════════════════════════════
  if (phase === "finished" && !finished) return null;

  if (phase === "finished" && finished) {
    const pct = Math.round((finished.correctCount / total) * 100);
    const remaining = total - finished.correctCount;

    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">
          {finished.completedAll ? "Quiz Complete!" : "Time’s Up!"}
        </h1>

        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 flex flex-col gap-4">
          <div>
            <span className="text-5xl font-bold text-gray-800">
              {finished.correctCount}
            </span>
            <span className="text-2xl text-gray-400 font-normal">
              {" "}
              / {total}
            </span>
          </div>
          <p className="text-sm text-gray-500">{pct}% of all capitals</p>

          <div className="border-t border-gray-100 pt-4 flex flex-col gap-2 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Time used</span>
              <span className="font-semibold text-gray-800">
                {formatMs(finished.elapsedMs)}
              </span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Not answered</span>
                <span className="font-semibold text-gray-800">{remaining}</span>
              </div>
            )}
          </div>
        </div>

        {(finished.isNewBestScore || finished.isNewFastestCompletion) && (
          <div className="w-full rounded-xl bg-green-50 border border-green-200 text-green-800 px-5 py-3 text-sm font-semibold">
            {finished.isNewFastestCompletion
              ? `New fastest completion — ${formatMs(finished.elapsedMs)}`
              : `New best score — ${finished.correctCount} / ${total}`}
          </div>
        )}

        {/* Missed answers */}
        {queue.length > 0 && (
          <MissedAnswersSection
            items={queue.map((e) => ({
              code: e.country.code,
              label: e.country.name,
              sublabel: e.capital.name,
              flagUrl: `https://flagcdn.com/w80/${e.country.code}.png`,
            }))}
          />
        )}

        <button
          onClick={startQuiz}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-base
                     hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation"
        >
          Play Again
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RUNNING SCREEN
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-3 sm:gap-5">
      <div className="w-full flex items-center justify-between">
        <span
          className={`text-2xl font-bold font-mono tabular-nums ${timerColour}`}
        >
          {formatSeconds(timeRemaining)}
        </span>
        <div className="text-sm text-right text-gray-500">
          <span className="font-semibold text-gray-800">{correctCount}</span>
          {" correct · "}
          <span className="font-semibold text-gray-800">
            {total - correctCount}
          </span>
          {" left"}
        </div>
      </div>

      {current && <CapitalDisplay entry={current} />}

      <input
        ref={inputRef}
        type="text"
        value={guess}
        onChange={(e) => handleGuessChange(e.target.value)}
        placeholder="Type capital city name…"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base
                   placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="w-full flex gap-3">
        <button
          onClick={handleSkip}
          className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm
                     hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
        >
          Skip
        </button>
        <button
          onClick={() => finishQuiz(false)}
          className="flex-1 py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-sm
                     hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
        >
          Finish Quiz
        </button>
      </div>
    </div>
  );
}
