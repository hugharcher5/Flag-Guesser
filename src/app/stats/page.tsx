/**
 * Personal stats page — Flag Guesser performance for the signed-in user.
 * Server component: queries Supabase directly, no client JS needed.
 */

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';

const TOTAL_FLAGS = 195;
const CONTINENT_ORDER = [
  'Europe',
  'Asia',
  'Africa',
  'North America',
  'South America',
  'Oceania',
];

type ContBreakdown = Record<string, { correct: number; seen: number }>;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pct(n: number, d: number): string {
  if (d === 0) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-gray-800 tabular-nums">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
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

  const { data: results } = await supabase
    .from('game_results')
    .select('score, correct, completion_time, continent_breakdown, created_at')
    .eq('user_id', user.id)
    .eq('game_mode', 'flag_guesser')
    .order('created_at', { ascending: false });

  const games = results ?? [];
  const totalGames = games.length;
  const wins = games.filter((g) => g.correct).length;
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
  const allScores = games.map((g) => g.score);
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const totalPoints = allScores.reduce((s, x) => s + x, 0);
  const avgScore = totalGames > 0 ? totalPoints / totalGames : 0;
  const completionTimes = games
    .filter((g) => g.correct && typeof g.completion_time === 'number')
    .map((g) => g.completion_time as number);
  const bestCompletionTime = completionTimes.length > 0 ? Math.min(...completionTimes) : null;

  // Aggregate continent breakdown across all games that have it.
  const continentAgg: ContBreakdown = {};
  for (const game of games) {
    const bd = game.continent_breakdown as ContBreakdown | null;
    if (!bd) continue;
    for (const [cont, stats] of Object.entries(bd)) {
      if (!continentAgg[cont]) continentAgg[cont] = { correct: 0, seen: 0 };
      continentAgg[cont].correct += stats.correct;
      continentAgg[cont].seen += stats.seen;
    }
  }

  const continentRows = CONTINENT_ORDER
    .filter((cont) => continentAgg[cont])
    .map((cont) => ({
      name: cont,
      correct: continentAgg[cont].correct,
      seen: continentAgg[cont].seen,
      accuracy: continentAgg[cont].seen > 0
        ? (continentAgg[cont].correct / continentAgg[cont].seen) * 100
        : 0,
    }));

  const hasContinentData = continentRows.length > 0;

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">Your Stats</h1>
          <p className="text-sm text-gray-500">
            {profile?.username ?? user.email} · Flag Guesser
          </p>
        </div>

        {totalGames === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
            No games played yet. Play a round of Flag Guesser to see your stats here.
          </div>
        ) : (
          <>
            {/* Overall stats */}
            <section className="flex flex-col gap-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Games Played" value={String(totalGames)} />
                <StatCard
                  label="Win Rate"
                  value={`${Math.round(winRate)}%`}
                  sub={`${wins} of ${totalGames} complete`}
                />
                <StatCard
                  label="Best Score"
                  value={`${bestScore} / ${TOTAL_FLAGS}`}
                  sub={bestScore === TOTAL_FLAGS ? 'Perfect!' : undefined}
                />
                <StatCard
                  label="Best Time"
                  value={bestCompletionTime !== null ? formatTime(bestCompletionTime) : '—'}
                  sub={bestCompletionTime !== null ? 'all 195 correct' : 'complete a full run'}
                />
                <StatCard
                  label="Total Points"
                  value={totalPoints.toLocaleString()}
                />
                <StatCard
                  label="Avg Score"
                  value={`${Math.round(avgScore)} / ${TOTAL_FLAGS}`}
                />
              </div>
            </section>

            {/* Continent breakdown */}
            <section className="flex flex-col gap-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Continent Breakdown
              </h2>

              {!hasContinentData ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 text-center text-sm text-gray-400">
                  Continent tracking starts with your next game.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="px-5 py-3 text-left">Continent</th>
                        <th className="px-5 py-3 text-right">Seen</th>
                        <th className="px-5 py-3 text-right">Correct</th>
                        <th className="px-5 py-3 text-right">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {continentRows.map((row) => (
                        <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-800">{row.name}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-gray-500">
                            {row.seen.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums text-gray-500">
                            {row.correct.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span
                              className={`font-semibold tabular-nums ${
                                row.accuracy >= 80
                                  ? 'text-green-600'
                                  : row.accuracy >= 60
                                  ? 'text-amber-600'
                                  : 'text-red-500'
                              }`}
                            >
                              {pct(row.correct, row.seen)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals row */}
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                        <td className="px-5 py-3">All continents</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {continentRows.reduce((s, r) => s + r.seen, 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {continentRows.reduce((s, r) => s + r.correct, 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {pct(
                            continentRows.reduce((s, r) => s + r.correct, 0),
                            continentRows.reduce((s, r) => s + r.seen, 0),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* Nav */}
        <div className="flex gap-4">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
            ← Back to games
          </a>
          <a href="/leaderboard/flag-guesser" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
            Leaderboard →
          </a>
        </div>

      </div>
    </div>
  );
}
