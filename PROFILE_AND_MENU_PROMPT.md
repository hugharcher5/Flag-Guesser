# User Profile Pages & Three-Dot Menu — Claude Code Prompt

Add a three-dot context menu to every username displayed anywhere in the app (leaderboards, friends list, friends leaderboards). Clicking the menu shows options to add friend and view profile. Also build a public user profile page.

## Existing Architecture Reference

- Supabase server client: `createSupabaseServer()` from `@/lib/supabase/server`
- Supabase browser client: `supabase` from `@/lib/supabase/client`
- Profiles table columns: `id`, `username`, `country`, `best_score`, `total_points`, `total_games`, `games_by_mode` (jsonb), `setup_complete`
- Friends table: `friends` with `requester_id`, `addressee_id`, `status` ('pending'/'accepted')
- Friends API: `/api/friends/add` (POST, body: `{ username }`)
- Flag images: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
- Country field may be a name ("Ireland") or code ("IE"). Use this helper everywhere:

```typescript
function getCountryCode(value: string | null): string | null {
  if (!value) return null;
  if (value.length === 2 && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const country = countries.find(c => c.name === value);
  return country?.code ?? null;
}
```

- Import countries from `@/data/countries`
- Stats computation reference: see `src/app/stats/page.tsx` and `src/app/stats/StatsClient.tsx` for how stats are fetched and displayed for the current user. The profile page needs to do the same thing but for ANY user.
- All pages use: gray-50 background, white rounded-2xl cards, border-gray-200, shadow-sm, Tailwind

## What to Build

### 1. API Endpoint: `src/app/api/users/[username]/route.ts`

GET endpoint that returns a public profile for any user by username.

- Look up the user in `profiles` by username (case-insensitive using `.ilike()`)
- Return 404 if not found
- Return their public data:
  - `username`, `country`
  - `games_by_mode` (the jsonb field — this contains all their stats per mode)
  - `best_score`, `total_points`, `total_games`
- Also return the friendship status between the current user and this user:
  - Query the `friends` table for any row where (requester_id = me AND addressee_id = them) OR (requester_id = them AND addressee_id = me)
  - Return `friendStatus`: `"none"` | `"pending_sent"` | `"pending_received"` | `"accepted"`
  - This tells the profile page whether to show "Add Friend", "Request Sent", "Accept Request", or "Already Friends"
- The endpoint should work even if the viewer is not signed in (just omit friendStatus or return "none")

### 2. User Profile Page: `src/app/profile/[username]/page.tsx`

A clean, fun public profile page. This should be a SERVER component that fetches data, then passes it to a client component for interactivity.

**Layout — make this look polished and fun, not just a data dump:**

**Profile Header Section:**
- Large flag image (w-12 or similar) next to the username in bold, large text
- Country name displayed below the username
- Friend status button:
  - If `friendStatus === "none"`: Show "Add Friend" button (dark bg, white text)
  - If `friendStatus === "pending_sent"`: Show "Request Sent" button (gray, disabled)
  - If `friendStatus === "pending_received"`: Show "Accept Request" button (green)
  - If `friendStatus === "accepted"`: Show "Friends ✓" badge (green outline, not a button)
- The Add Friend button should call `/api/friends/add` with `{ username }` and update the UI state on success

**Stats Section — use tabs like the existing stats page:**
- Three tabs: "Flag Guesser" | "Shape Guesser" | "Globe Guesser"
- The `games_by_mode` jsonb field stores stats per mode. Parse it the same way the leaderboard API does (see `src/app/api/leaderboard/route.ts` for the structure)

**Flag Guesser tab stats to show:**
- Games Played, Best Score (out of 195), Best Completion Time, Total Points
- Use the same StatCard component style as `src/app/stats/StatsClient.tsx`

**Shape Guesser / Globe Guesser tab stats to show:**
- Games Played, Total Points, Average Guesses, Games Won, Win Rate

**If a mode has no games played**, show a friendly empty state like "No Flag Guesser games yet"

**Navigation:**
- "← Back to leaderboard" link at the top (use `router.back()` or link to `/leaderboard`)

### 3. Three-Dot Menu Component: `src/components/UserMenu.tsx`

Create a reusable dropdown menu component that attaches to any username row.

**Props:**
```typescript
interface UserMenuProps {
  username: string;
  friendStatus: "none" | "pending_sent" | "pending_received" | "accepted" | "self";
  onFriendAdded?: () => void; // callback to refresh the list after adding
}
```

**Behavior:**
- Renders a vertical three-dot icon button (⋮ or use three small dots)
- On click, shows a small dropdown menu with absolute positioning
- The dropdown appears to the right or below the dots, overlaying other content
- Clicking outside the dropdown closes it

**Menu options:**

1. **"Add Friend"** — only show if `friendStatus === "none"`
   - On click: call `/api/friends/add` with `{ username }`
   - Show brief success/error feedback (e.g., change menu item text to "Request Sent!" for 2 seconds)
   - Call `onFriendAdded` callback if provided

2. **"Request Sent"** — show if `friendStatus === "pending_sent"`, greyed out / disabled

3. **"Friends ✓"** — show if `friendStatus === "accepted"`, greyed out as informational

4. **"View Profile"** — always show regardless of friend status
   - On click: navigate to `/profile/{username}`

- Do NOT show the menu at all if `friendStatus === "self"` (the current user's own row)

**Styling:**
- Three dots button: `text-gray-400 hover:text-gray-600`, small padding, cursor-pointer
- Dropdown: white bg, rounded-lg, border border-gray-200, shadow-lg, z-50
- Menu items: px-4 py-2, text-sm, hover:bg-gray-50, cursor-pointer
- Divider line between "Add Friend" and "View Profile"

### 4. Integrate the Menu into ALL User Lists

You need to add the `UserMenu` component everywhere another user's username appears. To know the friend status for each user, you'll need to fetch the current user's friends list and check against it.

**IMPORTANT**: For this to work, the leaderboard API endpoints and friends list endpoint need to also return each user's `id` (the profile UUID). Update these endpoints to include `id` in the returned data so the frontend can determine friend status.

#### Update `src/app/api/leaderboard/route.ts`:
- For the flag_guesser mode: also select and return `id` (the profile id) for each entry
- For the shape/globe modes: also select and return `id` for each entry

#### Update `src/app/api/friends/leaderboard/route.ts`:
- Also return `id` for each entry

#### Update `src/app/api/friends/list/route.ts`:
- Already returns friend data — make sure `id` is included

#### Files to add the UserMenu to:

**`src/app/leaderboard/flag-guesser/page.tsx`:**
- Add a new column at the end of each row (no header needed, narrow width)
- Render `<UserMenu username={entry.username} friendStatus={...} />`
- To determine friendStatus: on page load, also fetch `/api/friends/list` and `/api/friends/sent` and `/api/friends/pending` to build a lookup map of username → status
- Compare each leaderboard entry against the map
- If the entry is the current user, pass `friendStatus="self"`
- To know who the current user is: fetch the current user via Supabase auth on the client side

**`src/app/leaderboard/shape-guesser/page.tsx`:**
- Same approach as above

**`src/app/leaderboard/globe-guesser/page.tsx`:**
- Same approach as above

**`src/app/leaderboard/friends/flag-guesser/page.tsx`:**
- Add UserMenu to each row
- All entries here are already friends, so `friendStatus="accepted"` (except for self which is "self")

**`src/app/leaderboard/friends/shape-guesser/page.tsx`:**
- Same as above

**`src/app/leaderboard/friends/globe-guesser/page.tsx`:**
- Same as above

**`src/app/friends/page.tsx`:**
- In the Friends tab list: add the three-dot menu next to each friend's username
- `friendStatus="accepted"` for all friends in this list
- In the Received tab: add menu with `friendStatus="pending_received"`
- In the Sent tab: add menu with `friendStatus="pending_sent"`

### 5. Implementation Notes

- Use `useEffect` to close the dropdown when clicking outside (add a document click listener)
- The UserMenu should use `useRouter` from `next/navigation` for navigation to profile pages
- Make sure the three-dot menu doesn't interfere with the existing row hover styles
- The menu should work on mobile (tap to open, tap outside to close)
- Keep the three dots subtle — they shouldn't dominate the row visually
- For leaderboard pages, batch the friend status lookups into a single useEffect that runs on mount, rather than making separate API calls per row
- Use a simple approach: create a `useFriendStatuses` hook or just fetch `/api/friends/list`, `/api/friends/sent`, `/api/friends/pending` in parallel on mount, then build a `Map<string, FriendStatus>` from the results
