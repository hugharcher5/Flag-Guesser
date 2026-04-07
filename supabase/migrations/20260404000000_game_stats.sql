-- ============================================================
-- profiles
-- One row per auth user. Created automatically on first sign-in
-- via the trigger below.
-- ============================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text,
  total_games   integer not null default 0,
  total_points  integer not null default 0,
  best_score    integer not null default 0,
  games_by_mode jsonb   not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keep updated_at current automatically.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create a profile row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- game_results
-- ============================================================

create table if not exists public.game_results (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  game_mode        text not null check (game_mode in ('flag_guesser', 'speed_quiz', 'country_shape_guesser')),
  score            integer not null default 0,
  guesses_count    integer not null default 0,
  correct          boolean not null default false,
  completion_time  integer,           -- seconds; null if not tracked
  country_guessed  text,
  created_at       timestamptz not null default now()
);

create index if not exists game_results_user_id_idx  on public.game_results (user_id);
create index if not exists game_results_game_mode_idx on public.game_results (game_mode);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.game_results enable row level security;

-- profiles: users can read any profile (for leaderboard), only write their own.
create policy "profiles: public read"
  on public.profiles for select using (true);

create policy "profiles: owner insert"
  on public.profiles for insert with check (auth.uid() = id);

create policy "profiles: owner update"
  on public.profiles for update using (auth.uid() = id);

-- game_results: users can only see and insert their own rows.
create policy "game_results: owner select"
  on public.game_results for select using (auth.uid() = user_id);

create policy "game_results: owner insert"
  on public.game_results for insert with check (auth.uid() = user_id);
