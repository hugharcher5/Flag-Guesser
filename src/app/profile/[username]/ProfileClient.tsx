'use client';

import { useState } from 'react';
import countries from '@/data/countries';

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self';

export interface FlagModeStats {
  gamesPlayed: number;
  bestScore: number;
  bestCompletionTime: number | null;
  totalPoints: number;
}

export interface BasicModeStats {
  gamesPlayed: number;
  totalPoints: number;
  gamesWon: number;
  totalGuesses: number;
  bestScore: number;
}

export interface ProfileClientProps {
  username: string;
  country: string | null;
  bestScore: number;
  totalPoints: number;
  totalGames: number;
  flagStats: FlagModeStats | null;
  shapeStats: BasicModeStats | null;
  globeStats: BasicModeStats | null;
  initialFriendStatus: FriendStatus;
  friendshipId: string | null;
}

type TabKey = 'flag' | 'shape' | 'globe';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'flag', label: 'Flag Guesser' },
  { key: 'shape', label: 'Shape Guesser' },
  { key: 'globe', label: 'Globe Guesser' },
];
const TOTAL_FLAGS = 195;

function getCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length === 2 && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const country = countries.find((c) => c.name === value);
  return country?.code ?? null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

function FriendButton({
  status,
  friendshipId,
  username,
  onChange,
}: {
  status: FriendStatus;
  friendshipId: string | null;
  username: string;
  onChange: (s: FriendStatus) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function addFriend() {
    setLoading(true);
    const res = await fetch('/api/friends/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    setLoading(false);
    if (res.ok) onChange('pending_sent');
  }

  async function acceptFriend() {
    if (!friendshipId) return;
    setLoading(true);
    const res = await fetch('/api/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId }),
    });
    setLoading(false);
    if (res.ok) onChange('accepted');
  }

  if (status === 'self' || status === 'none' && !true) return null;

  if (status === 'none') {
    return (
      <button
        onClick={addFriend}
        disabled={loading}
        className="px-4 py-1.5 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Add Friend'}
      </button>
    );
  }
  if (status === 'pending_sent') {
    return (
      <span className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-400 cursor-default">
        Request Sent
      </span>
    );
  }
  if (status === 'pending_received') {
    return (
      <button
        onClick={acceptFriend}
        disabled={loading}
        className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Accepting…' : 'Accept Request'}
      </button>
    );
  }
  if (status === 'accepted') {
    return (
      <span className="px-4 py-1.5 rounded-lg border border-green-300 text-sm text-green-700 font-medium cursor-default">
        Friends ✓
      </span>
    );
  }
  return null;
}

export default function ProfileClient({
  username,
  country,
  bestScore,
  totalPoints,
  totalGames,
  flagStats,
  shapeStats,
  globeStats,
  initialFriendStatus,
  friendshipId,
}: ProfileClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('flag');
  const [friendStatus, setFriendStatus] = useState<FriendStatus>(initialFriendStatus);
  const countryCode = getCountryCode(country);

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Back */}
        <a
          href="/leaderboard"
          className="self-start text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          ← Back to leaderboard
        </a>

        {/* Profile header card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-6 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {/* Flag */}
            {countryCode ? (
              <img
                src={`https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`}
                alt={country ?? ''}
                className="w-14 h-auto rounded-md object-contain shadow-sm shrink-0"
              />
            ) : (
              <div className="w-14 h-10 rounded-md bg-gray-100 shrink-0" />
            )}

            {/* Username + country */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-800 truncate">{username}</h1>
              {country && (
                <p className="text-sm text-gray-500 truncate">{country}</p>
              )}
            </div>

            {/* Friend button */}
            {friendStatus !== 'self' && (
              <div className="shrink-0">
                <FriendButton
                  status={friendStatus}
                  friendshipId={friendshipId}
                  username={username}
                  onChange={setFriendStatus}
                />
              </div>
            )}
          </div>

          {/* Overall stats row */}
          <div className="flex gap-4 pt-2 border-t border-gray-100">
            <div className="flex flex-col items-center flex-1">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Games</span>
              <span className="text-lg font-bold text-gray-800 tabular-nums">{(totalGames ?? 0).toLocaleString()}</span>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="flex flex-col items-center flex-1">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Points</span>
              <span className="text-lg font-bold text-gray-800 tabular-nums">{(totalPoints ?? 0).toLocaleString()}</span>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="flex flex-col items-center flex-1">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Best Score</span>
              <span className="text-lg font-bold text-gray-800 tabular-nums">{bestScore ?? 0} / {TOTAL_FLAGS}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'flag' && (
          flagStats && flagStats.gamesPlayed > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Games Played" value={String(flagStats.gamesPlayed)} />
              <StatCard
                label="Best Score"
                value={`${flagStats.bestScore} / ${TOTAL_FLAGS}`}
                sub={flagStats.bestScore === TOTAL_FLAGS ? 'Perfect!' : undefined}
              />
              <StatCard
                label="Best Time"
                value={flagStats.bestCompletionTime !== null ? formatTime(flagStats.bestCompletionTime) : '—'}
                sub={flagStats.bestCompletionTime !== null ? 'all 195 correct' : undefined}
              />
              <StatCard label="Total Points" value={flagStats.totalPoints.toLocaleString()} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
              No Flag Guesser games yet.
            </div>
          )
        )}

        {activeTab === 'shape' && (
          shapeStats && shapeStats.gamesPlayed > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Games Played" value={String(shapeStats.gamesPlayed)} />
              <StatCard label="Games Won" value={String(shapeStats.gamesWon)} />
              <StatCard
                label="Win Rate"
                value={`${Math.round((shapeStats.gamesWon / shapeStats.gamesPlayed) * 100)}%`}
              />
              <StatCard label="Total Points" value={shapeStats.totalPoints.toLocaleString()} />
              <StatCard
                label="Avg Guesses"
                value={shapeStats.gamesPlayed > 0 ? (shapeStats.totalGuesses / shapeStats.gamesPlayed).toFixed(1) : '—'}
              />
              <StatCard label="Best Score" value={String(shapeStats.bestScore)} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
              No Shape Guesser games yet.
            </div>
          )
        )}

        {activeTab === 'globe' && (
          globeStats && globeStats.gamesPlayed > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Games Played" value={String(globeStats.gamesPlayed)} />
              <StatCard label="Games Won" value={String(globeStats.gamesWon)} />
              <StatCard
                label="Win Rate"
                value={`${Math.round((globeStats.gamesWon / globeStats.gamesPlayed) * 100)}%`}
              />
              <StatCard label="Total Points" value={globeStats.totalPoints.toLocaleString()} />
              <StatCard
                label="Avg Guesses"
                value={globeStats.gamesPlayed > 0 ? (globeStats.totalGuesses / globeStats.gamesPlayed).toFixed(1) : '—'}
              />
              <StatCard label="Best Score" value={String(globeStats.bestScore)} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
              No Globe Guesser games yet.
            </div>
          )
        )}

      </div>
    </div>
  );
}
