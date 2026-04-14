'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { UserResponse } from '@supabase/supabase-js';
import countries from '@/data/countries';

// ── Country list ─────────────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [...countries].sort((a, b) => a.name.localeCompare(b.name));

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// ── Validation ────────────────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function formatError(username: string): string | null {
  if (username.length > 0 && username.length < 3) return 'At least 3 characters required.';
  if (username.length > 20) return 'Maximum 20 characters.';
  if (username.length >= 3 && !/^[a-zA-Z0-9_]+$/.test(username))
    return 'Letters, numbers, and underscores only.';
  return null;
}

// ── Sanitise auto-generated username from Google display name ─────────────────

function sanitiseUsername(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();

  // userId is needed to exclude the current user from the uniqueness check
  const [userId, setUserId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('');

  const [formatErr, setFormatErr] = useState<string | null>(null);
  const [takenErr, setTakenErr] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ref to cancel stale debounce timers
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth guard: redirect unauthenticated users; pre-fill from profile ────────
  useEffect(() => {
    supabase.auth.getUser().then(async (result: UserResponse) => {
      const user = result.data.user;
      if (!user) {
        router.replace('/');
        return;
      }

      // Already completed setup — skip this page
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, setup_complete')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.setup_complete) {
        router.replace('/');
        return;
      }

      setUserId(user.id);

      // Pre-fill with sanitised auto-generated username if one exists
      if (profile?.username) {
        setUsername(sanitiseUsername(profile.username));
      }

      setPageLoading(false);
    });
  }, [router]);

  // ── Debounced username uniqueness check ──────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const err = formatError(username);
    setFormatErr(err);

    if (err !== null || !USERNAME_RE.test(username) || !userId) {
      setTakenErr(null);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    setTakenErr(null);

    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .maybeSingle();

      setTakenErr(data ? 'Username already taken.' : null);
      setCheckingUsername(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, userId]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || checkingUsername || formatErr || takenErr) return;

    setSubmitting(true);
    setSubmitError(null);

    const res = await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), country }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error ?? 'Something went wrong. Please try again.');
      setSubmitting(false);
      return;
    }

    router.replace('/');
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 flex flex-col gap-5 animate-pulse">
          <div className="h-7 w-40 bg-gray-100 rounded" />
          <div className="h-4 w-56 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const hasError = !!(formatErr || takenErr);
  const canSubmit = !submitting && !checkingUsername && !hasError && username.length >= 3 && country.length > 0;

  // ── Form ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 flex flex-col gap-7">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-800">Welcome!</h1>
          <p className="text-sm text-gray-500">
            Choose a username and country to complete your profile.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. map_wizard_99"
              maxLength={20}
              className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                hasError
                  ? 'border-red-400 bg-red-50 focus:ring-red-400'
                  : 'border-gray-300 bg-white'
              }`}
            />
            <p className="text-xs text-gray-400">
              3–20 characters · letters, numbers, and underscores only
            </p>
            {/* Feedback line: format error → taken error → checking → clear */}
            {formatErr && (
              <p className="text-xs text-red-600">{formatErr}</p>
            )}
            {!formatErr && takenErr && (
              <p className="text-xs text-red-600">{takenErr}</p>
            )}
            {!formatErr && !takenErr && checkingUsername && (
              <p className="text-xs text-gray-400">Checking availability…</p>
            )}
            {!formatErr && !takenErr && !checkingUsername && USERNAME_RE.test(username) && (
              <p className="text-xs text-green-600">Username is available.</p>
            )}
          </div>

          {/* Country */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="country" className="text-sm font-medium text-gray-700">
              Country
            </label>
            <div className="relative">
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="">Select your country…</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.name}>
                    {flagEmoji(c.code)} {c.name}
                  </option>
                ))}
              </select>
              {/* Chevron */}
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M4 6l4 4 4-4H4Z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="text-xs text-red-600">{submitError}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-xl bg-gray-800 text-white font-semibold text-sm
                       hover:bg-gray-900 active:bg-black transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </form>

      </div>
    </div>
  );
}
