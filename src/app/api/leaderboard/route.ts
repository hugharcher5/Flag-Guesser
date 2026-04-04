import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

const VALID_MODES = ['flag_guesser', 'speed_quiz', 'country_shape_guesser'];
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
    // Filter by game_mode: rank users by games played in that mode,
    // breaking ties with total_points.
    const { data, error } = await supabase
      .from('profiles')
      .select('username, total_points, total_games, best_score, games_by_mode')
      .order('total_points', { ascending: false })
      .limit(limit * 5); // over-fetch so we can filter client-side

    if (error) {
      console.error('leaderboard fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    // Keep only users who have played in this mode and take top `limit`.
    const filtered = (data ?? [])
      .filter((p) => {
        const gm = p.games_by_mode as Record<string, number> | null;
        return gm && (gm[mode] ?? 0) > 0;
      })
      .slice(0, limit)
      .map((p, i) => ({ rank: i + 1, username: p.username, total_points: p.total_points, total_games: p.total_games, best_score: p.best_score, games_in_mode: (p.games_by_mode as Record<string, number>)[mode] }));

    return NextResponse.json({ leaderboard: filtered, mode }, { status: 200 });
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
