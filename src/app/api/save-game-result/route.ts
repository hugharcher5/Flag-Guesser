import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

const VALID_MODES = ['flag_guesser', 'country_shape_guesser'] as const;
type GameMode = (typeof VALID_MODES)[number];

interface SaveGameBody {
  game_mode: GameMode;
  score: number;
  guesses_count: number;
  correct: boolean;
  completion_time?: number;
  country_guessed?: string;
  continent_breakdown?: Record<string, { correct: number; seen: number }>;
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
  if (typeof score !== 'number' || score < 0) {
    return NextResponse.json({ error: 'score must be a non-negative number' }, { status: 400 });
  }
  if (typeof guesses_count !== 'number' || guesses_count < 0) {
    return NextResponse.json({ error: 'guesses_count must be a non-negative number' }, { status: 400 });
  }
  if (typeof correct !== 'boolean') {
    return NextResponse.json({ error: 'correct must be a boolean' }, { status: 400 });
  }

  // Insert game result
  const { error: insertError } = await supabase.from('game_results').insert({
    user_id: user.id,
    game_mode,
    score,
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

  // Ensure a profile row exists — create one if the sign-in trigger missed it.
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

  // Update aggregated stats
  const games_by_mode = (profile.games_by_mode ?? {}) as Record<string, number>;
  const updatedStats = {
    total_games: profile.total_games + 1,
    total_points: profile.total_points + score,
    best_score: Math.max(profile.best_score, score),
    games_by_mode: {
      ...games_by_mode,
      [game_mode]: (games_by_mode[game_mode] ?? 0) + 1,
    },
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
