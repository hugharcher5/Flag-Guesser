-- Add per-continent accuracy breakdown to game results.
-- Stored as: { "Africa": {"correct": 12, "seen": 15}, "Asia": {...}, ... }
-- NULL for older rows that predate this change.

alter table public.game_results
  add column if not exists continent_breakdown jsonb;
