"use client";

import { useEffect, useState } from "react";
import UserMenu from "@/components/UserMenu";
import { supabase } from "@/lib/supabase/client";

type SortKey = "total_points" | "avg_guesses" | "games_won";

interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  total_points: number;
  avg_guesses: number;
  games_won: number;
  games_played: number;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-500 font-bold">1</span>;
  if (rank === 2) return <span className="text-gray-400 font-bold">2</span>;
  if (rank === 3) return <span className="text-amber-700 font-bold">3</span>;
  return <span className="text-gray-500">{rank}</span>;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "total_points", label: "Total Points" },
  { key: "avg_guesses", label: "Avg Guesses" },
  { key: "games_won", label: "Games Won" },
];

function sortEntries(entries: LeaderboardEntry[], sort: SortKey): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (sort === "avg_guesses") return a.avg_guesses - b.avg_guesses;
    if (sort === "games_won") return b.games_won - a.games_won;
    return b.total_points - a.total_points;
  });
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

export default function FriendsGlobeGuesserLeaderboard() {
  const [rawEntries, setRawEntries] = useState<LeaderboardEntry[]>([]);
  const [sort, setSort] = useState<SortKey>("total_points");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      setCurrentUsername(data?.username ?? null);
    });
  }, []);

  useEffect(() => {
    fetch("/api/friends/leaderboard?mode=globe_guesser")
      .then((res) => {
        if (res.status === 401) throw new Error("Sign in to view the leaderboard.");
        if (!res.ok) throw new Error("Failed to load leaderboard.");
        return res.json();
      })
      .then((data) => setRawEntries(data.leaderboard ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const entries = sortEntries(rawEntries, sort);
  const metricHeader = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "";

  function metricValue(entry: LeaderboardEntry): string {
    if (sort === "avg_guesses") return entry.avg_guesses.toFixed(1);
    if (sort === "games_won") return entry.games_won.toLocaleString();
    return entry.total_points.toLocaleString();
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center px-4 py-10 pb-24">
      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">
            Friends Leaderboard — Globe Guesser
          </h1>
          <p className="text-sm text-gray-500">
            You and your friends · find countries on the 3D globe
          </p>
        </div>

        {/* Global / Friends toggle */}
        <div className="flex gap-2">
          <a
            href="/leaderboard/globe-guesser"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-gray-300 transition-colors"
          >
            Global
          </a>
          <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-white cursor-default">
            Friends
          </span>
        </div>

        {/* Sort tabs */}
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sort === opt.key
                  ? "bg-gray-800 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">

          {loading && (
            <div className="flex flex-col divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-6 h-4 bg-gray-100 rounded animate-pulse" />
                  <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-gray-100 rounded animate-pulse" />
                  <div className="w-12 h-4 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-400">No games played yet. Challenge your friends!</p>
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left w-12">#</th>
                  <th className="px-5 py-3 text-left">Username</th>
                  <th className="px-5 py-3 text-right">{metricHeader}</th>
                  <th className="px-5 py-3 text-right">Games</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => {
                  const fStatus = entry.username === currentUsername ? "self" : "accepted";
                  return (
                    <tr
                      key={entry.username}
                      className={`transition-colors hover:bg-gray-50 ${entry.rank <= 3 ? "bg-amber-50/30" : ""}`}
                    >
                      <td className="px-5 py-3.5 text-center tabular-nums">
                        <RankBadge rank={entry.rank} />
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">{entry.username}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-gray-800">
                        {metricValue(entry)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-500">
                        {entry.games_played.toLocaleString()}
                      </td>
                      <td className="px-2 py-3.5 text-right">
                        <UserMenu username={entry.username} friendStatus={fStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Links */}
        <div className="flex items-center justify-between">
          <a
            href="/leaderboard"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            ← All leaderboards
          </a>
          <a
            href="/leaderboard/globe-guesser"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            View global leaderboard →
          </a>
        </div>

      </div>
    </div>
  );
}
