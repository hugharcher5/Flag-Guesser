-- Add globe_guesser as a valid game mode.
-- Drop and recreate the check constraint to include the new value.

alter table public.game_results
  drop constraint if exists game_results_game_mode_check;

alter table public.game_results
  add constraint game_results_game_mode_check
  check (game_mode in ('flag_guesser', 'speed_quiz', 'country_shape_guesser', 'globe_guesser'));
