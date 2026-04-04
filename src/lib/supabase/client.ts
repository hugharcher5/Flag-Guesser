/**
 * Supabase browser client — use in 'use client' components.
 *
 * Uses @supabase/ssr's createBrowserClient which stores the session in
 * cookies (not localStorage), so the same session is readable server-side
 * by the dashboard page and the auth callback route.
 *
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are public keys.
 * They are safe to expose in the browser — access is controlled by Supabase
 * Row Level Security rules, not by keeping these values secret.
 */

import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
