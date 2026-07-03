"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import countries from "@/data/countries";
import UserMenu from "@/components/UserMenu";
import { useFriendStatuses } from "@/lib/useFriendStatuses";

interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  country: string | null;
  games_played: number;
  avg_km: number | null;
  best_avg_km: number | null;
}

function getCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length === 2 && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const country = countries.find((c) => c.name === value);
  return country?.code ?? null;
}

function formatKm(km: number | null): string {
  if (km === null) return "—";
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-500 font-bold">1</span>;
  if (rank === 2) return <span className="text-gray-400 font-bold">2</span>;
  if (rank === 3) return <span className="text-amber-700 font-bold">3</span>;
  return <span className="text-gray-500">{rank}</span>;
}

export default function FriendsLandmarkLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { statusMap, currentUsername, refresh } = useFriendStatuses();

  useEffect(() => {
    fetch("/api/friends/leaderboard?mode=landmark_guesser")
      .then((res) => {
        if (res.status === 401) throw new Error("Sign in to view the leaderboard.");
        if (!res.ok) throw new Error("Failed to load leaderboard.");
        return res.json();
      })
      .then((data) => setEntries(data.leaderboard ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center px-4 py-10 pb-24">
      <div className="w-full max-w-2xl flex flex-col gap-6">

        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">
            Landmark Guesser — Friends
          </h1>
          <p className="text-sm text-gray-500">
            You and your friends · sorted by best average distance
          </p>
        </div>

        <div className="flex gap-2">
          <a
            href="/leaderboard/landmark-guesser"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-gray-300 transition-colors"
          >
            Global
          </a>
          <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-white cursor-default">
            Friends
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">

          {loading && (
            <div className="flex flex-col divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-6 h-4 bg-gray-100 rounded animate-pulse" />
                  <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
                  <div className="w-20 h-4 bg-gray-100 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-gray-100 rounded animate-pulse" />
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
              <p className="text-sm text-gray-400">
                No Landmark Guesser games yet among you and your friends.
              </p>
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left w-12">#</th>
                  <th className="px-5 py-3 text-left">Username</th>
                  <th className="px-5 py-3 text-right">Best Avg</th>
                  <th className="px-5 py-3 text-right">Avg</th>
                  <th className="px-5 py-3 text-right">Games</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => {
                  const code = getCountryCode(entry.country);
                  const fStatus = entry.username === currentUsername
                    ? "self"
                    : (statusMap.get(entry.username) ?? "none");
                  return (
                    <tr
                      key={entry.rank}
                      className={`transition-colors hover:bg-gray-50 ${entry.rank <= 3 ? "bg-amber-50/30" : ""}`}
                    >
                      <td className="px-5 py-3.5 text-center tabular-nums">
                        <RankBadge rank={entry.rank} />
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">
                        <span className="flex items-center gap-2">
                          {code && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
                              alt={entry.country ?? ""}
                              title={entry.country ?? ""}
                              className="w-6 h-auto rounded-sm"
                            />
                          )}
                          {entry.username}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-gray-800 font-mono">
                        {formatKm(entry.best_avg_km)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-500 font-mono">
                        {formatKm(entry.avg_km)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-500">
                        {entry.games_played.toLocaleString()}
                      </td>
                      <td className="px-2 py-3.5 text-right">
                        <UserMenu username={entry.username} friendStatus={fStatus} onFriendAdded={refresh} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <a
          href="/"
          className="self-start text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          ← Back to games
        </a>

      </div>
    </div>
  );
}
