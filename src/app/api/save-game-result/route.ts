import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

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

interface FlagModeStats {
  games_played: number;
  best_score: number;
  best_completion_time: number | null;
  total_points: number;
}

// ── Username helpers ──────────────────────────────────────────────────────────

/** Turns a display name into a valid username base (max 16 chars, leaving room for _N suffix). */
function sanitizeUsername(raw: string): string {
  const sanitized = raw
    .replace(/[^a-zA-Z0-9_]/g, '_') // anything invalid → underscore
    .replace(/_+/g, '_')             // collapse runs of underscores
    .replace(/^_+|_+$/g, '')         // trim leading/trailing underscores
    .slice(0, 16);
  return sanitized || 'Player';
}

/**
 * Finds an available username by appending _2, _3, … up to _10.
 * Falls back to a short timestamp-based name if all are taken.
 */
async function findAvailableUsername(
  supabase: SupabaseClient,
  base: string,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = (attempt === 0 ? base : `${base}_${attempt + 1}`).slice(0, 20);
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // Fallback: timestamp suffix is unique enough in practice
  return `user_${Date.now().toString().slice(-8)}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

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
    resolvedScore = correct && guesses_count > 0 ? Math.round(100 / guesses_count) : 0;
  } else {
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ error: 'score must be a non-negative number' }, { status: 400 });
    }
    resolvedScore = score;
  }

  // ── Ensure profile exists BEFORE inserting game_results (FK constraint) ───────
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    const rawName =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split('@')[0] ??
      'Player';

    const baseUsername = sanitizeUsername(rawName);
    const uniqueUsername = await findAvailableUsername(supabase, baseUsername);

    const { error: createError } = await supabase.from('profiles').insert({
      id: user.id,
      username: uniqueUsername,
      total_games: 0,
      total_points: 0,
      best_score: 0,
      games_by_mode: {},
      setup_complete: true,
    });

    // Code 23505 = unique_violation (race condition: another request created it first)
    if (createError && createError.code !== '23505') {
      console.error('profile auto-create error:', createError.message);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }
  }

  // ── Insert game result ────────────────────────────────────────────────────────
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

  // ── Fetch current profile stats ───────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('total_games, total_points, best_score, games_by_mode')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('profile fetch error:', profileError?.message);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }

  // ── Update aggregated stats ───────────────────────────────────────────────────
  const games_by_mode = (profile.games_by_mode ?? {}) as Record<string, unknown>;

  if (game_mode === 'flag_guesser') {
    // Upgrade legacy number format to rich stats object on first write
    const prevRaw = games_by_mode[game_mode];
    const prev: FlagModeStats = typeof prevRaw === 'number'
      ? { games_played: prevRaw, best_score: 0, best_completion_time: null, total_points: 0 }
      : (prevRaw as FlagModeStats | undefined) ?? { games_played: 0, best_score: 0, best_completion_time: null, total_points: 0 };

    const newBestTime = correct && typeof completion_time === 'number'
      ? (prev.best_completion_time === null ? completion_time : Math.min(prev.best_completion_time, completion_time))
      : prev.best_completion_time;

    games_by_mode[game_mode] = {
      games_played: prev.games_played + 1,
      best_score: Math.max(prev.best_score, resolvedScore),
      best_completion_time: newBestTime,
      total_points: prev.total_points + resolvedScore,
    };
  } else {
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

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({
      total_games: profile.total_games + 1,
      total_points: profile.total_points + resolvedScore,
      best_score: Math.max(profile.best_score, resolvedScore),
      games_by_mode,
    })
    .eq('id', user.id)
    .select('username, total_games, total_points, best_score, games_by_mode')
    .single();

  if (updateError || !updatedProfile) {
    console.error('profile update error:', updateError?.message);
    return NextResponse.json({ error: 'Failed to update profile stats' }, { status: 500 });
  }

  return NextResponse.json({ stats: updatedProfile }, { status: 200 });
}
