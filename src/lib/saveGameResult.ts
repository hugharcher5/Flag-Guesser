import { supabase } from '@/lib/supabase/client';

interface SaveGamePayload {
  game_mode: 'flag_guesser' | 'country_shape_guesser' | 'globe_guesser' | 'speed_quiz' | 'capital_guesser' | 'landmark_guesser';
  score?: number;       // Optional for shape/globe — server computes it
  guesses_count: number;
  correct: boolean;
  completion_time?: number;
  country_guessed?: string;
  continent_breakdown?: Record<string, { correct: number; seen: number }>;
  avg_distance_km?: number;
  best_single_km?: number;
}

/**
 * Fire-and-forget wrapper around POST /api/save-game-result.
 * Silently skips if the user is not signed in and swallows any errors
 * so a network failure never breaks the game.
 */
export async function saveGameResult(payload: SaveGamePayload): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await fetch('/api/save-game-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Game must keep working even if the API call fails.
  }
}
