-- Add landmark_guesser to the game_mode CHECK constraint
-- This migration drops the existing constraint and recreates it with the new value.

ALTER TABLE game_results
  DROP CONSTRAINT IF EXISTS game_results_game_mode_check;

ALTER TABLE game_results
  ADD CONSTRAINT game_results_game_mode_check
  CHECK (game_mode IN (
    'flag_guesser',
    'country_shape_guesser',
    'globe_guesser',
    'capital_guesser',
    'speed_quiz',
    'landmark_guesser'
  ));
