"use client";

import { useState } from "react";

type TabKey = "flag_guesser" | "shape_guesser" | "globe_guesser";

export interface ContinentRow {
  name: string;
  correct: number;
  seen: number;
  accuracy: number;
}

export interface FlagStats {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  bestScore: number;
  totalPoints: number;
  avgScore: number;
  bestCompletionTime: number | null;
  continentRows: ContinentRow[];
  hasContinentData: boolean;
}

export interface BasicModeStats {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  bestScore: number;
  totalPoints: number;
  avgGuesses: number;
}

interface Props {
  username: string;
  flagStats: FlagStats;
  shapeStats: BasicModeStats;
  globeStats: BasicModeStats;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "flag_guesser", label: "Flag Guesser" },
  { key: "shape_guesser", label: "Shape Guesser" },
  { key: "globe_guesser", label: "Globe Guesser" },
];

const TOTAL_FLAGS = 195;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-gray-800 tabular-nums">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

function FlagGuesserTab({ stats }: { stats: FlagStats }) {
  if (stats.gamesPlayed === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
        No games played yet. Play a round of Flag Guesser to see your stats here.
      </div>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Games Played" value={String(stats.gamesPlayed)} />
          <StatCard
            label="Win Rate"
            value={`${Math.round(stats.winRate)}%`}
            sub={`${stats.wins} of ${stats.gamesPlayed} complete`}
          />
          <StatCard
            label="Best Score"
            value={`${stats.bestScore} / ${TOTAL_FLAGS}`}
            sub={stats.bestScore === TOTAL_FLAGS ? "Perfect!" : undefined}
          />
          <StatCard
            label="Best Time"
            value={stats.bestCompletionTime !== null ? formatTime(stats.bestCompletionTime) : "—"}
            sub={stats.bestCompletionTime !== null ? "all 195 correct" : "complete a full run"}
          />
          <StatCard label="Total Points" value={stats.totalPoints.toLocaleString()} />
          <StatCard
            label="Avg Score"
            value={`${Math.round(stats.avgScore)} / ${TOTAL_FLAGS}`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Continent Breakdown
        </h2>
        {!stats.hasContinentData ? (
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
                {stats.continentRows.map((row) => (
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
                            ? "text-green-600"
                            : row.accuracy >= 60
                            ? "text-amber-600"
                            : "text-red-500"
                        }`}
                      >
                        {pct(row.correct, row.seen)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                  <td className="px-5 py-3">All continents</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {stats.continentRows.reduce((s, r) => s + r.seen, 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {stats.continentRows.reduce((s, r) => s + r.correct, 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {pct(
                      stats.continentRows.reduce((s, r) => s + r.correct, 0),
                      stats.continentRows.reduce((s, r) => s + r.seen, 0),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function BasicModeTab({
  stats,
  modeName,
  leaderboardHref,
}: {
  stats: BasicModeStats;
  modeName: string;
  leaderboardHref: string;
}) {
  if (stats.gamesPlayed === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
        No games played yet. Play a round of {modeName} to see your stats here.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Games Played" value={String(stats.gamesPlayed)} />
        <StatCard
          label="Win Rate"
          value={`${Math.round(stats.winRate)}%`}
          sub={`${stats.wins} of ${stats.gamesPlayed} won`}
        />
        <StatCard
          label="Best Score"
          value={String(stats.bestScore)}
          sub={stats.bestScore === 100 ? "Won in 1 guess!" : undefined}
        />
        <StatCard label="Total Points" value={stats.totalPoints.toLocaleString()} />
        <StatCard
          label="Avg Guesses"
          value={stats.avgGuesses > 0 ? stats.avgGuesses.toFixed(1) : "—"}
          sub="per game"
        />
        <StatCard label="Games Won" value={String(stats.wins)} />
      </div>
      <div>
        <a
          href={leaderboardHref}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          View leaderboard →
        </a>
      </div>
    </section>
  );
}

export default function StatsClient({ username, flagStats, shapeStats, globeStats }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("flag_guesser");

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">Your Stats</h1>
          <p className="text-sm text-gray-500">{username}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "flag_guesser" && <FlagGuesserTab stats={flagStats} />}

        {activeTab === "shape_guesser" && (
          <BasicModeTab
            stats={shapeStats}
            modeName="Country Shape Guesser"
            leaderboardHref="/leaderboard/shape-guesser"
          />
        )}

        {activeTab === "globe_guesser" && (
          <BasicModeTab
            stats={globeStats}
            modeName="Globe Guesser"
            leaderboardHref="/leaderboard/globe-guesser"
          />
        )}

        {/* Nav */}
        <div className="flex gap-4">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
            ← Back to games
          </a>
          {activeTab === "flag_guesser" && (
            <a href="/leaderboard/flag-guesser" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              Leaderboard →
            </a>
          )}
        </div>

      </div>
    </div>
  );
}
