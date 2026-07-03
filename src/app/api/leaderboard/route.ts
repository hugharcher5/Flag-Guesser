export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

const VALID_MODES = ['flag_guesser', 'country_shape_guesser', 'globe_guesser', 'capital_guesser', 'landmark_guesser'];
const MAX_LIMIT = 50;

// These modes store rich stats in profiles.games_by_mode and use the profiles
// table (public read) for leaderboard queries instead of game_results (owner-only).
const PROFILE_STATS_MODES = new Set(['country_shape_guesser', 'globe_guesser']);
const LANDMARK_MODE = 'landmark_guesser';

interface ModeStats {
  games_played: number;
  total_points: number;
  games_won: number;
  total_guesses: number;
  best_score: number;
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const limitParam = searchParams.get('limit');
  const limit = Math.min(parseInt(limitParam ?? '10', 10) || 10, MAX_LIMIT);

  if (mode && !VALID_MODES.includes(mode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(', ')}` },
      { status: 400 },
    );
  }

  // ── Landmark Guesser leaderboard — sorted by best avg distance ascending ──────
  if (mode === LANDMARK_MODE) {
    interface LmStats { games_played: number; total_distance_km: number; best_avg_km: number | null; }

    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, username, country, games_by_mode')
      .limit(500);

    if (profilesErr) {
      console.error('landmark leaderboard fetch error:', profilesErr.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    const entries = (profiles ?? [])
      .map((p) => {
        const stats = (p.games_by_mode as Record<string, LmStats> | null)?.['landmark_guesser'];
        if (!stats || stats.games_played === 0) return null;
        const avg_km = stats.games_played > 0 ? stats.total_distance_km / stats.games_played : null;
        return {
          id: p.id,
          username: p.username ?? 'Unknown',
          country: (p.country as string | null) ?? null,
          games_played: stats.games_played,
          avg_km: avg_km !== null ? +avg_km.toFixed(1) : null,
          best_avg_km: stats.best_avg_km !== null ? +stats.best_avg_km.toFixed(1) : null,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => {
        if (a.best_avg_km !== null && b.best_avg_km !== null) return a.best_avg_km - b.best_avg_km;
        if (a.best_avg_km !== null) return -1;
        if (b.best_avg_km !== null) return 1;
        return 0;
      })
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, ...e }));

    return NextResponse.json({ leaderboard: entries, mode }, { status: 200 });
  }

  // ── Shape / Globe leaderboard — read from profiles (public read) ─────────────
  if (mode && PROFILE_STATS_MODES.has(mode)) {
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, username, games_by_mode')
      .limit(500);

    if (profilesErr) {
      console.error('leaderboard profiles fetch error:', profilesErr.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    const entries = (profiles ?? [])
      .map((p) => {
        const stats = (p.games_by_mode as Record<string, ModeStats> | null)?.[mode];
        if (!stats || stats.games_played === 0) return null;
        return {
          id: p.id,
          username: p.username ?? 'Unknown',
          total_points: stats.total_points,
          avg_guesses: +(stats.total_guesses / stats.games_played).toFixed(2),
          games_won: stats.games_won,
          games_played: stats.games_played,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      // Default sort: total_points descending, then games_won as tiebreaker
      .sort((a, b) => b.total_points - a.total_points || b.games_won - a.games_won)
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, ...e }));

    return NextResponse.json({ leaderboard: entries, mode }, { status: 200 });
  }

  // ── Flag / Capital Guesser leaderboard — read from profiles (public read) ────
  if (mode === 'flag_guesser' || mode === 'capital_guesser') {
    interface FlagStats {
      games_played: number;
      best_score: number;
      best_completion_time: number | null;
      total_points: number;
    }

    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, username, best_score, country, games_by_mode')
      .limit(500);

    if (profilesErr) {
      console.error('leaderboard profiles fetch error:', profilesErr.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    const entries = (profiles ?? [])
      .map((p) => {
        const raw = (p.games_by_mode as Record<string, unknown> | null)?.[mode];
        if (!raw) return null;

        // Handle legacy number format (games_played count only, no rich stats yet)
        if (typeof raw === 'number') {
          return raw > 0
            ? { id: p.id, username: p.username ?? 'Unknown', country: p.country ?? null, best_completion_time: null, best_score: p.best_score ?? 0, games_played: raw }
            : null;
        }

        const stats = raw as FlagStats;
        if (!stats.games_played) return null;
        return {
          id: p.id,
          username: p.username ?? 'Unknown',
          country: p.country ?? null,
          best_completion_time: stats.best_completion_time ?? null,
          best_score: p.best_score ?? 0,
          games_played: stats.games_played,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => {
        // Players with a completion time rank above those without
        if (a.best_completion_time !== null && b.best_completion_time !== null)
          return a.best_completion_time - b.best_completion_time;
        if (a.best_completion_time !== null) return -1;
        if (b.best_completion_time !== null) return 1;
        return b.best_score - a.best_score;
      })
      .slice(0, limit)
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    return NextResponse.json({ leaderboard: entries, mode }, { status: 200 });
  }

  // ── No mode filter — global leaderboard by total_points ──────────────────────
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, total_points, total_games, best_score')
    .order('total_points', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('leaderboard fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }

  const leaderboard = (data ?? []).map((p, i) => ({ rank: i + 1, ...p }));

  return NextResponse.json({ leaderboard }, { status: 200 });
}
