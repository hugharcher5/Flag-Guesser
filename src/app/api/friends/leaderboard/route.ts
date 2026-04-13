import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

const VALID_MODES = ['flag_guesser', 'country_shape_guesser', 'globe_guesser'];

interface FlagStats {
  games_played: number;
  best_score: number;
  best_completion_time: number | null;
  total_points: number;
}

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

  if (!mode || !VALID_MODES.includes(mode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(', ')}` },
      { status: 400 },
    );
  }

  // Get all accepted friend IDs
  const { data: friendships, error: friendErr } = await supabase
    .from('friends')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (friendErr) {
    console.error('friends leaderboard friendship error:', friendErr.message);
    return NextResponse.json({ error: 'Failed to fetch friends' }, { status: 500 });
  }

  const friendIds = (friendships ?? []).map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  // Include current user in the leaderboard
  const profileIds = [user.id, ...friendIds];

  // ── Flag Guesser ─────────────────────────────────────────────────────────────
  if (mode === 'flag_guesser') {
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('username, best_score, country, games_by_mode')
      .in('id', profileIds);

    if (profileErr) {
      console.error('friends flag leaderboard error:', profileErr.message);
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }

    const entries = (profiles ?? [])
      .map((p) => {
        const raw = (p.games_by_mode as Record<string, unknown> | null)?.['flag_guesser'];
        if (!raw) return null;

        if (typeof raw === 'number') {
          return raw > 0
            ? { username: p.username ?? 'Unknown', country: p.country ?? null, best_completion_time: null, best_score: p.best_score ?? 0, games_played: raw }
            : null;
        }

        const stats = raw as FlagStats;
        if (!stats.games_played) return null;
        return {
          username: p.username ?? 'Unknown',
          country: p.country ?? null,
          best_completion_time: stats.best_completion_time ?? null,
          best_score: p.best_score ?? 0,
          games_played: stats.games_played,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => {
        if (a.best_completion_time !== null && b.best_completion_time !== null)
          return a.best_completion_time - b.best_completion_time;
        if (a.best_completion_time !== null) return -1;
        if (b.best_completion_time !== null) return 1;
        return b.best_score - a.best_score;
      })
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    return NextResponse.json({ leaderboard: entries, mode }, { status: 200 });
  }

  // ── Shape / Globe ────────────────────────────────────────────────────────────
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('username, games_by_mode')
    .in('id', profileIds);

  if (profileErr) {
    console.error('friends shape/globe leaderboard error:', profileErr.message);
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
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => b.total_points - a.total_points || b.games_won - a.games_won)
    .map((e, i) => ({ rank: i + 1, ...e }));

  return NextResponse.json({ leaderboard: entries, mode }, { status: 200 });
}
