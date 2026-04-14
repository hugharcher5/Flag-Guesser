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
 *
 * The client is created lazily (on first property access) so that importing
 * this module at build time does not throw when env vars are not yet present.
 */

import { createBrowserClient } from '@supabase/ssr';

type Client = ReturnType<typeof createBrowserClient>;

let _instance: Client | undefined;

function getInstance(): Client {
  if (!_instance) {
    _instance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _instance;
}

export const supabase: Client = new Proxy({} as Client, {
  get(_target, prop) {
    const instance = getInstance();
    const val = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function'
      ? (val as (...args: unknown[]) => unknown).bind(instance)
      : val;
  },
});
