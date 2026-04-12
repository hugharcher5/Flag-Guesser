import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

const VALID_MODES = ['flag_guesser', 'country_shape_guesser', 'globe_guesser'];
const MAX_LIMIT = 50;

// These modes store rich stats in profiles.games_by_mode and use the profiles
// table (public read) for leaderboard queries instead of game_results (owner-only).
const PROFILE_STATS_MODES = new Set(['country_shape_guesser', 'globe_guesser']);

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

  // ── Shape / Globe leaderboard — read from profiles (public read) ─────────────
  if (mode && PROFILE_STATS_MODES.has(mode)) {
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('username, games_by_mode')
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
          username: p.username ?? 'Unknown',
          total_points: stats.total_points,
          avg_guesses: +(stats.total_guesses / stats.games_played).toFixed(2),
          games_won: stats.games_won,
          games_played: stats.games_played,
          best_score: stats.best_score,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      // Default sort: total_points descending, then games_won as tiebreaker
      .sort((a, b) => b.total_points - a.total_points || b.games_won - a.games_won)
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, ...e }));

    return NextResponse.json({ leaderboard: entries, mode }, { status: 200 });
  }

  // ── Flag Guesser leaderboard — aggregate from game_results ───────────────────
  if (mode === 'flag_guesser') {
    const { data: modeResults, error: modeError } = await supabase
      .from('game_results')
      .select('user_id, score, correct, completion_time')
      .eq('game_mode', mode);

    if (modeError) {
      console.error('leaderboard fetch error:', modeError.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    const userMap = new Map<string, { bestCompletionTime: number | null; gamesPlayed: number }>();
    for (const r of modeResults ?? []) {
      const entry = userMap.get(r.user_id) ?? { bestCompletionTime: null, gamesPlayed: 0 };
      entry.gamesPlayed++;
      if (r.correct && r.completion_time != null) {
        if (entry.bestCompletionTime === null || r.completion_time < entry.bestCompletionTime) {
          entry.bestCompletionTime = r.completion_time;
        }
      }
      userMap.set(r.user_id, entry);
    }

    if (userMap.size === 0) {
      return NextResponse.json({ leaderboard: [], mode }, { status: 200 });
    }

    const userIds = [...userMap.keys()];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, best_score')
      .in('id', userIds);

    if (profilesError) {
      console.error('leaderboard profiles fetch error:', profilesError.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, { username: p.username, best_score: p.best_score }]),
    );

    const sorted = [...userMap.entries()]
      .map(([userId, stats]) => ({
        username: profileMap.get(userId)?.username ?? 'Unknown',
        best_completion_time: stats.bestCompletionTime,
        best_score: profileMap.get(userId)?.best_score ?? 0,
        games_played: stats.gamesPlayed,
      }))
      .sort((a, b) => {
        if (a.best_completion_time !== null && b.best_completion_time !== null) {
          return a.best_completion_time - b.best_completion_time;
        }
        if (a.best_completion_time !== null) return -1;
        if (b.best_completion_time !== null) return 1;
        return b.best_score - a.best_score;
      })
      .slice(0, limit)
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    return NextResponse.json({ leaderboard: sorted, mode }, { status: 200 });
  }

  // ── No mode filter — global leaderboard by total_points ──────────────────────
  const { data, error } = await supabase
    .from('profiles')
    .select('username, total_points, total_games, best_score')
    .order('total_points', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('leaderboard fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }

  const leaderboard = (data ?? []).map((p, i) => ({ rank: i + 1, ...p }));

  return NextResponse.json({ leaderboard }, { status: 200 });
}
