"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import countries from "@/data/countries";
import type { Country } from "@/data/countries";
import { isCorrect } from "@/lib/fuzzy";
import { getRecords, updateRecords } from "@/lib/storage";
import type { SpeedQuizRecords } from "@/lib/storage";

const QUIZ_DURATION_S = 900; // 15 minutes
const TOTAL = countries.length;

type Phase = "idle" | "running" | "finished";

interface FinishedData {
  correctCount: number;
  elapsedMs: number;
  completedAll: boolean;
  isNewBestScore: boolean;
  isNewFastestCompletion: boolean;
}

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

export default function SpeedQuizMode() {
  const [phase, setPhase] = useState<Phase>("idle");
  // queue[0] is always the current flag. Correct answers remove from front;
  // skips move front to back. Queue length = TOTAL - correctCount always.
  const [queue, setQueue] = useState<Country[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(QUIZ_DURATION_S);
  const [guess, setGuess] = useState("");
  const [imgError, setImgError] = useState(false);
  const [finished, setFinished] = useState<FinishedData | null>(null);
  // Records loaded client-side only to avoid hydration mismatch.
  const [records, setRecords] = useState<SpeedQuizRecords>({
    bestScore: 0,
    fastestCompletion: null,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  // Refs mirror state values so timer/finish callbacks always read fresh data
  // without needing them as effect dependencies.
  const correctCountRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  // Guard: ensures finishQuiz runs exactly once per session.
  const hasFinishedRef = useRef(false);

  const current = phase === "running" ? (queue[0] ?? null) : null;

  // Load personal bests on client mount only.
  useEffect(() => {
    setRecords(getRecords());
  }, []);

  // Keep phaseRef in sync.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Focus the input whenever the current flag changes.
  const currentCode = current?.code ?? null;
  useEffect(() => {
    if (phase === "running") {
      inputRef.current?.focus();
      setImgError(false);
    }
  }, [phase, currentCode]);

  // ── Finish ──────────────────────────────────────────────────────────────
  const finishQuiz = useCallback((completedAll: boolean) => {
    if (hasFinishedRef.current) return; // prevent double-finish (timer + button race)
    hasFinishedRef.current = true;
    phaseRef.current = "finished";

    const elapsedMs = Math.min(
      Date.now() - startTimeRef.current,
      QUIZ_DURATION_S * 1000
    );
    const finalCorrect = correctCountRef.current;

    const { records: newRecords, isNewBestScore, isNewFastestCompletion } =
      updateRecords(finalCorrect, completedAll ? elapsedMs : null);

    setRecords(newRecords);
    setFinished({
      correctCount: finalCorrect,
      elapsedMs,
      completedAll,
      isNewBestScore,
      isNewFastestCompletion,
    });
    setPhase("finished");
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "running") return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, QUIZ_DURATION_S - Math.floor(elapsed / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0) {
        finishQuiz(false);
      }
    }, 250); // tick 4× per second so the countdown feels smooth
    return () => clearInterval(interval);
  }, [phase, finishQuiz]);

  // ── Start ────────────────────────────────────────────────────────────────
  const startQuiz = useCallback(() => {
    correctCountRef.current = 0;
    hasFinishedRef.current = false;
    startTimeRef.current = Date.now();
    setQueue(shuffled([...countries]));
    setCorrectCount(0);
    setTimeRemaining(QUIZ_DURATION_S);
    setGuess("");
    setFinished(null);
    setPhase("running");
  }, []);

  // ── Live answer checking ─────────────────────────────────────────────────
  const handleGuessChange = useCallback(
    (value: string) => {
      setGuess(value);
      if (!current || !value.trim()) return;

      if (isCorrect(value, current, countries)) {
        const newCount = correctCountRef.current + 1;
        correctCountRef.current = newCount;
        setCorrectCount(newCount);

        if (newCount === TOTAL) {
          // All 195 answered — finish immediately.
          finishQuiz(true);
        } else {
          // Remove current flag and clear input.
          setQueue((q) => q.slice(1));
          setGuess("");
        }
      }
    },
    [current, finishQuiz]
  );

  // ── Skip ─────────────────────────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
    setGuess("");
  }, []);

  // ── Timer colour ─────────────────────────────────────────────────────────
  const timerColour =
    timeRemaining > 120
      ? "text-gray-800"
      : timeRemaining > 60
      ? "text-amber-600"
      : "text-red-600";

  // ════════════════════════════════════════════════════════════════════════
  // START SCREEN
  // ════════════════════════════════════════════════════════════════════════
  if (phase === "idle") {
    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">
          Speed Quiz
        </h1>

        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
          Name all{" "}
          <span className="font-semibold text-gray-700">{TOTAL} world flags</span>{" "}
          as fast as you can. You have{" "}
          <span className="font-semibold text-gray-700">15 minutes</span>. Answers
          are checked as you type — no submit button. Skip flags to come back
          to them later.
        </p>

        {/* Personal bests */}
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 flex flex-col gap-3 text-left">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Personal Bests
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Best score</span>
            <span className="font-semibold text-gray-800">
              {records.bestScore > 0
                ? `${records.bestScore} / ${TOTAL}`
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

  // ════════════════════════════════════════════════════════════════════════
  // RESULTS SCREEN
  // ════════════════════════════════════════════════════════════════════════
  // Guard: finished state and phase are set together in finishQuiz, but add
  // an explicit fallback in case of any React batching edge case.
  if (phase === "finished" && !finished) return null;

  if (phase === "finished" && finished) {
    const pct = Math.round((finished.correctCount / TOTAL) * 100);
    const remaining = TOTAL - finished.correctCount;

    return (
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">
          {finished.completedAll ? "Quiz Complete!" : "Time's Up!"}
        </h1>

        {/* Score card */}
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 flex flex-col gap-4">
          <div>
            <span className="text-5xl font-bold text-gray-800">
              {finished.correctCount}
            </span>
            <span className="text-2xl text-gray-400 font-normal"> / {TOTAL}</span>
          </div>
          <p className="text-sm text-gray-500">{pct}% of all flags</p>

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

        {/* Personal best banner */}
        {(finished.isNewBestScore || finished.isNewFastestCompletion) && (
          <div className="w-full rounded-xl bg-green-50 border border-green-200 text-green-800 px-5 py-3 text-sm font-semibold">
            {finished.isNewFastestCompletion
              ? `New fastest completion — ${formatMs(finished.elapsedMs)}`
              : `New best score — ${finished.correctCount} / ${TOTAL}`}
          </div>
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

  // ════════════════════════════════════════════════════════════════════════
  // RUNNING SCREEN
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-3 sm:gap-5">

      {/* HUD: timer left, score right */}
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
            {TOTAL - correctCount}
          </span>
          {" left"}
        </div>
      </div>

      {/* Flag */}
      <div className="w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white flex items-center justify-center min-h-32 sm:min-h-40 p-3">
        {!current ? (
          <div className="w-full aspect-[3/2] bg-gray-100 animate-pulse rounded-xl" />
        ) : imgError ? (
          <div className="py-10 text-sm text-gray-400">Flag unavailable</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.code}
            src={`https://flagcdn.com/w640/${current.code}.png`}
            alt="Country flag"
            onError={() => setImgError(true)}
            className="max-w-full max-h-48 sm:max-h-72 w-auto h-auto block"
          />
        )}
      </div>

      {/* Live input — no submit button, answer is checked on every keystroke */}
      <input
        ref={inputRef}
        type="text"
        value={guess}
        onChange={(e) => handleGuessChange(e.target.value)}
        placeholder="Type country name…"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base
                   placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Actions */}
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
