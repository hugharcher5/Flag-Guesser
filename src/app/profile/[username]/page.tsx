export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import ProfileClient, {
  type FlagModeStats,
  type BasicModeStats,
  type LandmarkModeStats,
} from './ProfileClient';

interface RawFlagStats {
  games_played?: number;
  best_score?: number;
  best_completion_time?: number | null;
  total_points?: number;
}

interface RawModeStats {
  games_played?: number;
  total_points?: number;
  games_won?: number;
  total_guesses?: number;
  best_score?: number;
}

interface RawLandmarkStats {
  games_played?: number;
  total_distance_km?: number;
  best_avg_km?: number | null;
}

type GamesbyMode = Record<string, unknown>;

function parseFlagStats(raw: unknown, profileBestScore: number): FlagModeStats | null {
  if (!raw) return null;
  // Legacy: just a number (games played count)
  if (typeof raw === 'number') {
    return raw > 0
      ? { gamesPlayed: raw, bestScore: profileBestScore, bestCompletionTime: null, totalPoints: 0 }
      : null;
  }
  const s = raw as RawFlagStats;
  if (!s.games_played) return null;
  return {
    gamesPlayed: s.games_played,
    bestScore: profileBestScore,
    bestCompletionTime: s.best_completion_time ?? null,
    totalPoints: s.total_points ?? 0,
  };
}

function parseLandmarkStats(raw: unknown): LandmarkModeStats | null {
  if (!raw) return null;
  const s = raw as RawLandmarkStats;
  if (!s.games_played) return null;
  return {
    gamesPlayed: s.games_played,
    bestAvgKm: s.best_avg_km ?? null,
    avgKm: s.games_played > 0 && s.total_distance_km != null
      ? +(s.total_distance_km / s.games_played).toFixed(1)
      : null,
  };
}

function parseBasicStats(raw: unknown): BasicModeStats | null {
  if (!raw) return null;
  const s = raw as RawModeStats;
  if (!s.games_played) return null;
  return {
    gamesPlayed: s.games_played,
    totalPoints: s.total_points ?? 0,
    gamesWon: s.games_won ?? 0,
    totalGuesses: s.total_guesses ?? 0,
    bestScore: s.best_score ?? 0,
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();

  // Look up target profile (case-insensitive)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, country, best_score, total_points, total_games, games_by_mode')
    .ilike('username', username)
    .maybeSingle();

  if (!profile) notFound();

  // Friend status
  type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self';
  let friendStatus: FriendStatus = 'none';
  let friendshipId: string | null = null;

  if (user) {
    if (user.id === profile.id) {
      friendStatus = 'self';
    } else {
      const { data: friendship } = await supabase
        .from('friends')
        .select('id, requester_id, status')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),` +
          `and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`,
        )
        .maybeSingle();

      if (friendship) {
        friendshipId = friendship.id;
        if (friendship.status === 'accepted') {
          friendStatus = 'accepted';
        } else if (friendship.requester_id === user.id) {
          friendStatus = 'pending_sent';
        } else {
          friendStatus = 'pending_received';
        }
      }
    }
  }

  const gamesbyMode = (profile.games_by_mode as GamesbyMode) ?? {};
  const flagStats = parseFlagStats(gamesbyMode['flag_guesser'], profile.best_score ?? 0);
  const capitalStats = parseFlagStats(gamesbyMode['capital_guesser'], 0);
  const shapeStats = parseBasicStats(gamesbyMode['country_shape_guesser']);
  const globeStats = parseBasicStats(gamesbyMode['globe_guesser']);
  const landmarkStats = parseLandmarkStats(gamesbyMode['landmark_guesser']);

  return (
    <ProfileClient
      username={profile.username ?? username}
      country={profile.country ?? null}
      bestScore={profile.best_score ?? 0}
      totalPoints={profile.total_points ?? 0}
      totalGames={profile.total_games ?? 0}
      flagStats={flagStats}
      capitalStats={capitalStats}
      shapeStats={shapeStats}
      globeStats={globeStats}
      landmarkStats={landmarkStats}
      initialFriendStatus={friendStatus}
      friendshipId={friendshipId}
    />
  );
}
