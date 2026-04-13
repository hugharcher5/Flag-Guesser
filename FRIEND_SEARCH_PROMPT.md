# Friend Search Autocomplete — Claude Code Prompt

Add username autocomplete/suggestions to the "Add Friend" input on the friends page (`src/app/friends/page.tsx`).

## What to Build

### 1. New API Endpoint: `src/app/api/friends/search/route.ts`

- GET endpoint with query param `q` (the search string)
- Authenticate the user (return 401 if not signed in)
- If `q` is less than 2 characters, return empty array
- Query the `profiles` table for usernames that START WITH the search string (case-insensitive prefix match)
- Use Supabase's `.ilike()` filter: `.ilike('username', `${q}%`)`
- Exclude the current user from results
- Limit to 5 results
- For each match, return: `username`, `country`
- Use the same Supabase server client pattern as other API routes (`createSupabaseServer` from `@/lib/supabase/server`)

### 2. Update the Friends Page: `src/app/friends/page.tsx`

Update the "Add Friend" input section:

- Add a debounced search (300ms delay) that fires as the user types
- When the input has 2+ characters, call `/api/friends/search?q={input}`
- Show a dropdown list below the input with matching usernames
- Each suggestion should show: flag image (from flagcdn.com) + username
- Clicking a suggestion should fill the input with that username
- Pressing Enter or clicking "Add" sends the friend request as before
- Hide the dropdown when: input is cleared, a suggestion is clicked, input loses focus (with a small delay so clicks register), or results are empty
- If the search returns 0 results and the input has 2+ characters, show "No users found" in the dropdown

**Important styling notes:**
- The dropdown should appear directly below the input field
- Use absolute positioning so it overlays content below
- Match existing style: white bg, rounded-lg, border border-gray-200, shadow-md
- Each suggestion row: px-3 py-2, hover:bg-gray-50, cursor-pointer, text-sm
- Flag images: use the same pattern as the friends list — `https://flagcdn.com/w40/${code.toLowerCase()}.png` with `w-5 h-auto rounded-sm`
- Country values in the DB may be country names OR 2-letter codes. Use this helper:

```typescript
function getCountryCode(value: string | null): string | null {
  if (!value) return null;
  if (value.length === 2 && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  const country = countries.find(c => c.name === value);
  return country?.code ?? null;
}
```

- Import countries from `@/data/countries` if not already imported

**No other files need to be changed.** This is just a new API endpoint + updating the existing friends page.
