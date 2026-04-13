# Friends System Feature — Claude Code Prompt

Build a complete friends system for my Flag Guesser app. This is a Next.js App Router project using Supabase (PostgreSQL + Auth) with Tailwind CSS. The app already has Google OAuth sign-in, user profiles, game results, and leaderboards for three game modes (Flag Guesser, Shape Guesser, Globe Guesser).

## Existing Architecture Reference

- Supabase client (browser): `src/lib/supabase/client.ts`
- Supabase client (server): `src/lib/supabase/server.ts` — exports `createSupabaseServer()`
- Auth callback: `src/app/auth/callback/route.ts`
- Profiles table has columns: `id` (uuid, FK to auth.users), `username`, `country`, `best_score`, `total_points`, `total_games`, `games_by_mode` (jsonb), `setup_complete` (bool)
- Existing API pattern: see `src/app/api/leaderboard/route.ts` and `src/app/api/auth/update-profile/route.ts` for how endpoints are structured
- Existing leaderboard pages: `src/app/leaderboard/flag-guesser/page.tsx`, `src/app/leaderboard/shape-guesser/page.tsx`, `src/app/leaderboard/globe-guesser/page.tsx`
- Navigation bar: `src/components/NavBar.tsx`
- Country flag images use flagcdn.com: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
- All pages use the same visual style: gray-50 background, white rounded-2xl cards with border-gray-200, text-sm, Tailwind utility classes

## What to Build

### 1. Database Migration

Create `supabase/migrations/20260413000000_friends.sql`:

```sql
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

-- RLS Policies:
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

-- Users can delete friendships they're part of (unfriend)
create policy "Users can delete own friendships"
  on public.friends for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
```

IMPORTANT: After creating this migration file, tell me to run it manually in the Supabase SQL Editor. Do NOT try to run `supabase db push` or any Supabase CLI commands.

### 2. API Endpoints

Create these API route files:

#### `src/app/api/friends/add/route.ts`
- POST endpoint
- Body: `{ username: string }` — the username of the person to add
- Look up the target user's profile by username
- Check they exist, check no existing friendship in either direction
- Insert a new row with `requester_id = current user`, `addressee_id = target user`, `status = 'pending'`
- Return success or appropriate error

#### `src/app/api/friends/accept/route.ts`
- POST endpoint
- Body: `{ friendshipId: string }` — the UUID of the friends row
- Verify current user is the addressee_id
- Update status to 'accepted', set updated_at to now()

#### `src/app/api/friends/reject/route.ts`
- POST endpoint
- Body: `{ friendshipId: string }`
- Verify current user is the addressee_id
- Delete the row entirely

#### `src/app/api/friends/remove/route.ts`
- POST endpoint
- Body: `{ friendshipId: string }`
- Verify current user is either requester_id or addressee_id
- Delete the row

#### `src/app/api/friends/list/route.ts`
- GET endpoint
- Returns all accepted friends for the current user
- For each friendship, return the OTHER user's `id`, `username`, `country`
- Query: select from friends where (requester_id = me OR addressee_id = me) AND status = 'accepted', then join/lookup profiles for the other user

#### `src/app/api/friends/pending/route.ts`
- GET endpoint
- Returns all pending requests WHERE current user is the addressee (requests sent TO me)
- Return each request's `id` (friendship id), requester's `username`, `country`, `created_at`

#### `src/app/api/friends/sent/route.ts`
- GET endpoint
- Returns all pending requests WHERE current user is the requester (requests I sent)
- Return each request's `id`, addressee's `username`, `country`, `created_at`

#### `src/app/api/friends/leaderboard/route.ts`
- GET endpoint
- Query param: `mode` (flag_guesser, country_shape_guesser, globe_guesser)
- First get all accepted friend user IDs for current user
- Include the current user themselves in the list
- Then query profiles for those users and return leaderboard data
- For flag_guesser mode: return username, country, best_score, best_completion_time, games_played (same format as existing flag guesser leaderboard)
- For shape/globe modes: return username, total_points, avg_guesses, games_won, games_played (same format as existing shape/globe leaderboards)
- Sort and rank the same way as the existing leaderboards

### 3. Friends Management Page

Create `src/app/friends/page.tsx` — a client component page with:

**Layout:**
- Same visual style as the settings and leaderboard pages
- Header: "Friends" with subtitle showing friend count
- An "Add Friend" section at the top with a text input for username and an "Add" button
- Show success/error messages for add attempts (e.g., "Request sent!", "User not found", "Already friends")
- Three tabs below: "Friends" | "Received" | "Sent"

**Friends tab (default):**
- List of accepted friends showing: flag image (from flagcdn.com using their country code), username
- Each friend has a "Remove" button (with confirmation)
- Empty state: "No friends yet. Send a request above!"

**Received tab:**
- List of pending requests sent TO the current user
- Show: flag image, username, time since request
- Each has "Accept" and "Reject" buttons
- Show count badge on the tab label if there are pending requests (e.g., "Received (3)")

**Sent tab:**
- List of pending requests the current user has sent
- Show: flag image, username, time since sent
- Each has a "Cancel" button to withdraw the request
- Empty state: "No pending requests."

### 4. Friends-Only Leaderboard Pages

Create three pages that mirror the existing leaderboard pages but filtered to friends only:

#### `src/app/leaderboard/friends/flag-guesser/page.tsx`
- Same layout and columns as `src/app/leaderboard/flag-guesser/page.tsx`
- Title: "Friends Leaderboard — Flag Guesser"
- Fetches from `/api/friends/leaderboard?mode=flag_guesser`
- Include flag images next to usernames (same as existing leaderboard)
- Add a link to switch to the global leaderboard: "View global leaderboard →"

#### `src/app/leaderboard/friends/shape-guesser/page.tsx`
- Same layout as `src/app/leaderboard/shape-guesser/page.tsx` with sortable columns
- Title: "Friends Leaderboard — Shape Guesser"
- Fetches from `/api/friends/leaderboard?mode=country_shape_guesser`
- Add link to global leaderboard

#### `src/app/leaderboard/friends/globe-guesser/page.tsx`
- Same layout as `src/app/leaderboard/globe-guesser/page.tsx` with sortable columns
- Title: "Friends Leaderboard — Globe Guesser"
- Fetches from `/api/friends/leaderboard?mode=globe_guesser`
- Add link to global leaderboard

### 5. Navigation Updates

Update `src/components/NavBar.tsx`:
- Add a "Friends" link in the navigation bar (only visible when signed in)
- Style it the same as the existing nav links

Update the existing global leaderboard pages to include a link/tab to switch to friends-only view:
- On each leaderboard page (flag-guesser, shape-guesser, globe-guesser), add a toggle or link at the top: "Global" | "Friends" that switches between the two views
- The "Friends" link should navigate to `/leaderboard/friends/flag-guesser` etc.

### 6. Important Implementation Notes

- All API routes must authenticate the user with `supabase.auth.getUser()` and return 401 if not signed in
- Use the same error handling patterns as existing API routes
- The friends leaderboard should include the current user in the results (so you see yourself ranked among friends)
- Country values in the database may be either country NAMES (like "Ireland") or country CODES (like "IE"). Use this helper pattern for flag images:

```typescript
function getCountryCode(value: string | null): string | null {
  if (!value) return null;
  if (value.length === 2 && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const country = countries.find(c => c.name === value);
  return country?.code ?? null;
}
// Then use: src={`https://flagcdn.com/w40/${getCountryCode(country)?.toLowerCase()}.png`}
```

- Import countries from `@/data/countries` when needed
- Do NOT create any new database tables beyond the friends table described above
- Do NOT modify existing tables or API endpoints
- Match the existing UI style exactly (rounded-2xl cards, gray-50 bg, shadow-sm, etc.)
