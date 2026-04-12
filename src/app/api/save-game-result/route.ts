import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

const VALID_MODES = ['flag_guesser', 'country_shape_guesser', 'globe_guesser'] as const;
type GameMode = (typeof VALID_MODES)[number];

// Modes where the server computes the score (client value is ignored).
const SERVER_SCORED_MODES: Set<GameMode> = new Set(['country_shape_guesser', 'globe_guesser']);

interface SaveGameBody {
  game_mode: GameMode;
  score?: number;       // Optional for server-scored modes
  guesses_count: number;
  correct: boolean;
  completion_time?: number;
  country_guessed?: string;
  continent_breakdown?: Record<string, { correct: number; seen: number }>;
}

interface ModeStats {
  games_played: number;
  total_points: number;
  games_won: number;
  total_guesses: number;
  best_score: number;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SaveGameBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { game_mode, score, guesses_count, correct, completion_time, country_guessed, continent_breakdown } = body;

  // Validate required fields
  if (!VALID_MODES.includes(game_mode)) {
    return NextResponse.json(
      { error: `game_mode must be one of: ${VALID_MODES.join(', ')}` },
      { status: 400 },
    );
  }
  if (typeof guesses_count !== 'number' || guesses_count < 0) {
    return NextResponse.json({ error: 'guesses_count must be a non-negative number' }, { status: 400 });
  }
  if (typeof correct !== 'boolean') {
    return NextResponse.json({ error: 'correct must be a boolean' }, { status: 400 });
  }

  // For flag_guesser the client provides the score; for shape/globe compute server-side.
  let resolvedScore: number;
  if (SERVER_SCORED_MODES.has(game_mode)) {
    // (correct_guesses / total_guesses) × 100 — single-answer game so correct_guesses = 0 or 1
    resolvedScore = correct && guesses_count > 0 ? Math.round(100 / guesses_count) : 0;
  } else {
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ error: 'score must be a non-negative number' }, { status: 400 });
    }
    resolvedScore = score;
  }

  // Insert game result
  const { error: insertError } = await supabase.from('game_results').insert({
    user_id: user.id,
    game_mode,
    score: resolvedScore,
    guesses_count,
    correct,
    completion_time: typeof completion_time === 'number' ? completion_time : null,
    country_guessed: typeof country_guessed === 'string' ? country_guessed : null,
    continent_breakdown: continent_breakdown ?? null,
  });

  if (insertError) {
    console.error('game_results insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to save game result' }, { status: 500 });
  }

  // Ensure a profile row exists
  const username =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'Player';

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, username, total_games: 0, total_points: 0, best_score: 0, games_by_mode: {} },
      { onConflict: 'id', ignoreDuplicates: true },
    );

  if (upsertError) {
    console.error('profile upsert error:', upsertError.message);
    return NextResponse.json({ error: 'Failed to initialise profile' }, { status: 500 });
  }

  // Fetch current profile stats
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('total_games, total_points, best_score, games_by_mode')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('profile fetch error:', profileError?.message);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }

  const games_by_mode = (profile.games_by_mode ?? {}) as Record<string, unknown>;

  if (game_mode === 'flag_guesser') {
    // Legacy: just increment the count
    games_by_mode[game_mode] = (games_by_mode[game_mode] as number ?? 0) + 1;
  } else {
    // Rich per-mode stats used by leaderboards
    const prev = (games_by_mode[game_mode] as ModeStats | undefined) ?? {
      games_played: 0, total_points: 0, games_won: 0, total_guesses: 0, best_score: 0,
    };
    games_by_mode[game_mode] = {
      games_played: prev.games_played + 1,
      total_points: prev.total_points + resolvedScore,
      games_won: prev.games_won + (correct ? 1 : 0),
      total_guesses: prev.total_guesses + guesses_count,
      best_score: Math.max(prev.best_score, resolvedScore),
    };
  }

  const updatedStats = {
    total_games: profile.total_games + 1,
    total_points: profile.total_points + resolvedScore,
    best_score: Math.max(profile.best_score, resolvedScore),
    games_by_mode,
  };

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update(updatedStats)
    .eq('id', user.id)
    .select('username, total_games, total_points, best_score, games_by_mode')
    .single();

  if (updateError || !updatedProfile) {
    console.error('profile update error:', updateError?.message);
    return NextResponse.json({ error: 'Failed to update profile stats' }, { status: 500 });
  }

  return NextResponse.json({ stats: updatedProfile }, { status: 200 });
}
