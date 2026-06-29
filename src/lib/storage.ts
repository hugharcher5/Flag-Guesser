// localStorage helpers for Speed Quiz personal bests.
// All data is stored client-side only — no backend, no accounts.

export interface SpeedQuizRecords {
  bestScore: number;               // highest number of correct answers in one session
  fastestCompletion: number | null; // fastest time (ms) to get all 195 correct; null if never done
}

const STORAGE_KEY = "flagGuesser_speedQuiz";
export const CAPITAL_STORAGE_KEY = "capitalGuesser_speedQuiz";

const DEFAULT: SpeedQuizRecords = { bestScore: 0, fastestCompletion: null };

export function getRecords(key: string = STORAGE_KEY): SpeedQuizRecords {
  if (typeof window === "undefined") return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT };
    return JSON.parse(raw) as SpeedQuizRecords;
  } catch {
    return { ...DEFAULT };
  }
}

function saveRecords(r: SpeedQuizRecords, key: string = STORAGE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(r));
  } catch {
    // localStorage may be unavailable (private browsing, storage quota, etc.)
  }
}

export interface UpdateResult {
  records: SpeedQuizRecords;
  isNewBestScore: boolean;
  isNewFastestCompletion: boolean;
}

export function updateRecords(
  correct: number,
  completionMs: number | null, // only set when all were answered correctly
  key: string = STORAGE_KEY,
): UpdateResult {
  const prev = getRecords(key);

  const isNewBestScore = correct > 0 && correct > prev.bestScore;
  const isNewFastestCompletion =
    completionMs !== null &&
    (prev.fastestCompletion === null || completionMs < prev.fastestCompletion);

  const records: SpeedQuizRecords = {
    bestScore: Math.max(prev.bestScore, correct),
    fastestCompletion: isNewFastestCompletion
      ? completionMs
      : prev.fastestCompletion,
  };

  saveRecords(records, key);
  return { records, isNewBestScore, isNewFastestCompletion };
}
