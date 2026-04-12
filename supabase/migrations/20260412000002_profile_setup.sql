-- Add country and setup_complete to profiles.
-- New users are redirected to /auth/setup until setup_complete = true.

alter table public.profiles
  add column if not exists country text;

alter table public.profiles
  add column if not exists setup_complete boolean not null default false;

-- Existing users already have usernames — they don't need onboarding.
update public.profiles
  set setup_complete = true
  where username is not null;
