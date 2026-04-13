-- Friends table
-- Always store the SENDER as requester_id and RECEIVER as addressee_id
-- status: 'pending' or 'accepted'
create table public.friends (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Prevent duplicate friendships and self-friending
  constraint no_self_friend check (requester_id != addressee_id),
  constraint unique_friendship unique (requester_id, addressee_id)
);

-- Index for fast lookups
create index idx_friends_addressee on public.friends(addressee_id);
create index idx_friends_status on public.friends(status);

-- Enable RLS
alter table public.friends enable row level security;

-- Users can see friendships they're part of
create policy "Users can view own friendships"
  on public.friends for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Users can send friend requests (insert where they are the requester)
create policy "Users can send friend requests"
  on public.friends for insert
  with check (auth.uid() = requester_id and status = 'pending');

-- Users can update friendships they received (accept/reject)
create policy "Addressee can update friend requests"
  on public.friends for update
  using (auth.uid() = addressee_id);

-- Users can delete friendships they're part of (unfriend / cancel)
create policy "Users can delete own friendships"
  on public.friends for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
