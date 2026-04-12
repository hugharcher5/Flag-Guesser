import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

const VALID_MODES = ['flag_guesser', 'country_shape_guesser'];
const MAX_LIMIT = 50;

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

  if (mode) {
    // Query game_results to compute per-user best completion_time and total score.
    const { data: modeResults, error: modeError } = await supabase
      .from('game_results')
      .select('user_id, score, correct, completion_time')
      .eq('game_mode', mode);

    if (modeError) {
      console.error('leaderboard fetch error:', modeError.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    // Aggregate per user: best completion_time (for correct games) and total score.
    const userMap = new Map<string, { bestCompletionTime: number | null; totalScore: number; gamesPlayed: number }>();
    for (const r of modeResults ?? []) {
      const entry = userMap.get(r.user_id) ?? { bestCompletionTime: null, totalScore: 0, gamesPlayed: 0 };
      entry.gamesPlayed++;
      entry.totalScore += r.score ?? 0;
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

    // Fetch usernames for all users who have played this mode.
    const userIds = [...userMap.keys()];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);

    if (profilesError) {
      console.error('leaderboard profiles fetch error:', profilesError.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

    // Sort: fastest completion_time first (nulls last), then highest total_score.
    const sorted = [...userMap.entries()]
      .map(([userId, stats]) => ({
        username: profileMap.get(userId) ?? 'Unknown',
        best_completion_time: stats.bestCompletionTime,
        total_score: stats.totalScore,
        games_played: stats.gamesPlayed,
      }))
      .sort((a, b) => {
        if (a.best_completion_time !== null && b.best_completion_time !== null) {
          return a.best_completion_time - b.best_completion_time;
        }
        if (a.best_completion_time !== null) return -1;
        if (b.best_completion_time !== null) return 1;
        return b.total_score - a.total_score;
      })
      .slice(0, limit)
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    return NextResponse.json({ leaderboard: sorted, mode }, { status: 200 });
  }

  // No mode filter — global leaderboard by total_points.
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
