"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import countries from "@/data/countries";
import type { Country, Continent } from "@/data/countries";
import { isCorrect } from "@/lib/fuzzy";

type Filter = Continent | "All";

const CONTINENTS: Filter[] = [
  "All",
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
];

function shuffled(arr: Country[]): Country[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PracticeMode() {
  const [filter, setFilter] = useState<Filter>("All");
  // null on server; populated client-side to avoid hydration mismatch.
  const [current, setCurrent] = useState<Country | null>(null);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [imgError, setImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<Country[]>([]);

  const drawNext = useCallback(
    (lastCode: string | null, activeFilter: Filter): Country => {
      if (deckRef.current.length === 0) {
        const pool =
          activeFilter === "All"
            ? [...countries]
            : countries.filter((c) => c.continent === activeFilter);
        const deck = shuffled(pool);
        if (lastCode && deck.length > 1 && deck[deck.length - 1].code === lastCode) {
          const i = Math.floor(Math.random() * (deck.length - 1));
          [deck[i], deck[deck.length - 1]] = [deck[deck.length - 1], deck[i]];
        }
        deckRef.current = deck;
      }
      return deckRef.current.pop()!;
    },
    []
  );

  // Runs on mount and on filter change — resets deck and picks first country.
  useEffect(() => {
    deckRef.current = [];
    setCurrent(drawNext(null, filter));
    setGuess("");
    setResult(null);
  }, [filter, drawNext]);

  useEffect(() => {
    inputRef.current?.focus();
    setImgError(false);
  }, [current]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!current || result !== null || guess.trim() === "") return;
      const correct = isCorrect(guess, current, countries);
      setResult(correct ? "correct" : "incorrect");
      setScore((s) => ({
        correct: s.correct + (correct ? 1 : 0),
        total: s.total + 1,
      }));
    },
    [guess, current, result]
  );

  const handleNext = useCallback(() => {
    setCurrent(drawNext(current?.code ?? null, filter));
    setGuess("");
    setResult(null);
  }, [current, filter, drawNext]);

  const answered = result !== null;

  useEffect(() => {
    if (!answered) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [answered, handleNext]);

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6">

      <h1 className="text-3xl font-bold tracking-tight text-gray-800">
        Flag Guesser
      </h1>

      {/* Continent filter */}
      <select
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value as Filter);
          setScore({ correct: 0, total: 0 });
        }}
        className="w-full px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        {CONTINENTS.map((c) => (
          <option key={c} value={c}>
            {c === "All" ? "All Countries" : c}
          </option>
        ))}
      </select>

      {/* Score */}
      <p className="text-sm text-gray-500 font-medium">
        Score:{" "}
        <span className="text-gray-800 font-semibold">
          {score.correct} / {score.total}
        </span>
      </p>

      {/* Flag */}
      <div className="w-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white flex items-center justify-center min-h-40 p-3">
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
            className="max-w-full max-h-72 w-auto h-auto block"
          />
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          disabled={answered || !current}
          placeholder="Type country name…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base
                     placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:bg-gray-100 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={answered || !current || guess.trim() === ""}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-base
                     hover:bg-blue-700 active:bg-blue-800 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </form>

      {/* Result */}
      {answered && current && (
        <div
          className={`w-full rounded-xl px-5 py-4 text-center space-y-1
            ${result === "correct"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
            }`}
        >
          <p className="text-xl font-bold">
            {result === "correct" ? "✓ Correct!" : "✗ Incorrect"}
          </p>
          {result === "incorrect" && (
            <p className="text-sm">
              The answer was{" "}
              <span className="font-semibold">{current.name}</span>
            </p>
          )}
        </div>
      )}

      {/* Next flag */}
      {answered && (
        <button
          onClick={handleNext}
          className="w-full py-3 rounded-xl bg-gray-800 text-white font-semibold text-base
                     hover:bg-gray-900 active:bg-black transition-colors"
        >
          Next Flag →
        </button>
      )}
    </div>
  );
}
