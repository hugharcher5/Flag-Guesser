export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import StatsClient, {
  type FlagStats,
  type BasicModeStats,
  type LandmarkStats,
  type ContinentRow,
} from './StatsClient';

const CONTINENT_ORDER = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];

type ContBreakdown = Record<string, { correct: number; seen: number }>;

function computeBasicStats(
  games: { score: number; guesses_count: number; correct: boolean }[],
): BasicModeStats {
  const gamesPlayed = games.length;
  const wins = games.filter((g) => g.correct).length;
  const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  const allScores = games.map((g) => g.score);
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const totalPoints = allScores.reduce((s, x) => s + x, 0);
  const totalGuesses = games.reduce((s, g) => s + g.guesses_count, 0);
  const avgGuesses = gamesPlayed > 0 ? totalGuesses / gamesPlayed : 0;
  return { gamesPlayed, wins, winRate, bestScore, totalPoints, avgGuesses };
}

export default async function StatsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  const username = profile?.username ?? user.email ?? 'Player';

  // ── Fetch all five modes in parallel ─────────────────────────────────────────
  const [flagRes, capitalRes, shapeRes, globeRes, landmarkProfileRes] = await Promise.all([
    supabase
      .from('game_results')
      .select('score, correct, completion_time, continent_breakdown, created_at')
      .eq('user_id', user.id)
      .eq('game_mode', 'flag_guesser')
      .order('created_at', { ascending: false }),
    supabase
      .from('game_results')
      .select('score, correct, completion_time, continent_breakdown, created_at')
      .eq('user_id', user.id)
      .eq('game_mode', 'capital_guesser')
      .order('created_at', { ascending: false }),
    supabase
      .from('game_results')
      .select('score, guesses_count, correct, created_at')
      .eq('user_id', user.id)
      .eq('game_mode', 'country_shape_guesser'),
    supabase
      .from('game_results')
      .select('score, guesses_count, correct, created_at')
      .eq('user_id', user.id)
      .eq('game_mode', 'globe_guesser'),
    supabase
      .from('profiles')
      .select('games_by_mode')
      .eq('id', user.id)
      .single(),
  ]);

  // ── Flag Guesser stats ────────────────────────────────────────────────────────
  const flagGames = flagRes.data ?? [];
  const flagGamesPlayed = flagGames.length;
  const flagWins = flagGames.filter((g) => g.correct).length;
  const flagScores = flagGames.map((g) => g.score);
  const flagBestScore = flagScores.length > 0 ? Math.max(...flagScores) : 0;
  const flagTotalPoints = flagScores.reduce((s, x) => s + x, 0);
  const flagAvgScore = flagGamesPlayed > 0 ? flagTotalPoints / flagGamesPlayed : 0;
  const completionTimes = flagGames
    .filter((g) => g.correct && typeof g.completion_time === 'number')
    .map((g) => g.completion_time as number);
  const bestCompletionTime = completionTimes.length > 0 ? Math.min(...completionTimes) : null;

  // Continent breakdown
  const continentAgg: ContBreakdown = {};
  for (const game of flagGames) {
    const bd = game.continent_breakdown as ContBreakdown | null;
    if (!bd) continue;
    for (const [cont, stats] of Object.entries(bd)) {
      if (!continentAgg[cont]) continentAgg[cont] = { correct: 0, seen: 0 };
      continentAgg[cont].correct += stats.correct;
      continentAgg[cont].seen += stats.seen;
    }
  }
  const continentRows: ContinentRow[] = CONTINENT_ORDER
    .filter((cont) => continentAgg[cont])
    .map((cont) => ({
      name: cont,
      correct: continentAgg[cont].correct,
      seen: continentAgg[cont].seen,
      accuracy: continentAgg[cont].seen > 0
        ? (continentAgg[cont].correct / continentAgg[cont].seen) * 100
        : 0,
    }));

  const flagStats: FlagStats = {
    gamesPlayed: flagGamesPlayed,
    wins: flagWins,
    winRate: flagGamesPlayed > 0 ? (flagWins / flagGamesPlayed) * 100 : 0,
    bestScore: flagBestScore,
    totalPoints: flagTotalPoints,
    avgScore: flagAvgScore,
    bestCompletionTime,
    continentRows,
    hasContinentData: continentRows.length > 0,
  };

  // ── Capital Guesser stats ──────────────────────────────────────────────────────
  const capitalGames = capitalRes.data ?? [];
  const capitalGamesPlayed = capitalGames.length;
  const capitalWins = capitalGames.filter((g) => g.correct).length;
  const capitalScores = capitalGames.map((g) => g.score);
  const capitalBestScore = capitalScores.length > 0 ? Math.max(...capitalScores) : 0;
  const capitalTotalPoints = capitalScores.reduce((s, x) => s + x, 0);
  const capitalAvgScore = capitalGamesPlayed > 0 ? capitalTotalPoints / capitalGamesPlayed : 0;
  const capitalCompletionTimes = capitalGames
    .filter((g) => g.correct && typeof g.completion_time === 'number')
    .map((g) => g.completion_time as number);
  const capitalBestCompletionTime = capitalCompletionTimes.length > 0 ? Math.min(...capitalCompletionTimes) : null;

  const capitalContinentAgg: ContBreakdown = {};
  for (const game of capitalGames) {
    const bd = game.continent_breakdown as ContBreakdown | null;
    if (!bd) continue;
    for (const [cont, stats] of Object.entries(bd)) {
      if (!capitalContinentAgg[cont]) capitalContinentAgg[cont] = { correct: 0, seen: 0 };
      capitalContinentAgg[cont].correct += stats.correct;
      capitalContinentAgg[cont].seen += stats.seen;
    }
  }
  const capitalContinentRows: ContinentRow[] = CONTINENT_ORDER
    .filter((cont) => capitalContinentAgg[cont])
    .map((cont) => ({
      name: cont,
      correct: capitalContinentAgg[cont].correct,
      seen: capitalContinentAgg[cont].seen,
      accuracy: capitalContinentAgg[cont].seen > 0
        ? (capitalContinentAgg[cont].correct / capitalContinentAgg[cont].seen) * 100
        : 0,
    }));

  const capitalStats: FlagStats = {
    gamesPlayed: capitalGamesPlayed,
    wins: capitalWins,
    winRate: capitalGamesPlayed > 0 ? (capitalWins / capitalGamesPlayed) * 100 : 0,
    bestScore: capitalBestScore,
    totalPoints: capitalTotalPoints,
    avgScore: capitalAvgScore,
    bestCompletionTime: capitalBestCompletionTime,
    continentRows: capitalContinentRows,
    hasContinentData: capitalContinentRows.length > 0,
  };

  // ── Shape / Globe stats ───────────────────────────────────────────────────────
  const shapeStats = computeBasicStats(
    (shapeRes.data ?? []).map((g) => ({ score: g.score, guesses_count: g.guesses_count, correct: g.correct })),
  );
  const globeStats = computeBasicStats(
    (globeRes.data ?? []).map((g) => ({ score: g.score, guesses_count: g.guesses_count, correct: g.correct })),
  );

  // ── Landmark stats ─────────────────────────────────────────────────────────────
  interface RawLmStats { games_played: number; total_distance_km: number; best_avg_km: number | null; }
  const lmRaw = (landmarkProfileRes.data?.games_by_mode as Record<string, RawLmStats> | null)?.['landmark_guesser'];
  const landmarkStats: LandmarkStats = {
    gamesPlayed: lmRaw?.games_played ?? 0,
    bestAvgKm: lmRaw?.best_avg_km ?? null,
    avgKm: lmRaw && lmRaw.games_played > 0 ? +(lmRaw.total_distance_km / lmRaw.games_played).toFixed(1) : null,
  };

  return (
    <StatsClient
      username={username}
      flagStats={flagStats}
      capitalStats={capitalStats}
      shapeStats={shapeStats}
      globeStats={globeStats}
      landmarkStats={landmarkStats}
    />
  );
}
