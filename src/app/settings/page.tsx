'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { UserResponse } from '@supabase/supabase-js';
import countries from '@/data/countries';

// ── Country list ──────────────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [...countries].sort((a, b) => a.name.localeCompare(b.name));

function countryCodeFromName(name: string): string | undefined {
  return countries.find((c) => c.name === name)?.code;
}

/** Convert country name or code to country code for flag image lookup. */
function getCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;

  // If it's already a 2-letter code, return it
  if (value.length === 2 && /^[A-Za-z]{2}$/.test(value)) {
    return value.toUpperCase();
  }

  // Otherwise try to look up the code by country name
  const country = countries.find(c => c.name === value);
  return country?.code ?? null;
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Saved values (from DB)
  const [savedUsername, setSavedUsername] = useState('');
  const [savedCountry, setSavedCountry] = useState('');

  // Live form values
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('');

  const [formatErr, setFormatErr] = useState<string | null>(null);
  const [takenErr, setTakenErr] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth guard + load profile ─────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }: UserResponse) => {
      if (!user) {
        router.replace('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, country')
        .eq('id', user.id)
        .maybeSingle();

      const u = profile?.username ?? '';
      const c = profile?.country ?? '';

      setUserId(user.id);
      setSavedUsername(u);
      setSavedCountry(c);
      setUsername(u);
      setCountry(c);
      setPageLoading(false);
    });
  }, [router]);

  // ── Debounced username uniqueness check ───────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const err = formatError(username);
    setFormatErr(err);

    // No need to check if unchanged from saved value
    if (username === savedUsername) {
      setTakenErr(null);
      setCheckingUsername(false);
      return;
    }

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
  }, [username, userId, savedUsername]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || checkingUsername || formatErr || takenErr) return;

    setSubmitting(true);
    setSubmitError(null);
    setSaveSuccess(false);

    const res = await fetch('/api/auth/update-profile', {
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

    // Update saved values and show success banner
    setSavedUsername(username.trim());
    setSavedCountry(country);
    setUsername(username.trim());
    setSubmitting(false);
    setSaveSuccess(true);

    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSaveSuccess(false), 3500);
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const hasChanges = username.trim() !== savedUsername || country !== savedCountry;
  const hasError = !!(formatErr || takenErr);
  const canSubmit = hasChanges && !hasError && !checkingUsername && !submitting;

  const currentCountryCode = countryCodeFromName(savedCountry);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 flex flex-col gap-5 animate-pulse">
          <div className="h-7 w-44 bg-gray-100 rounded" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Page ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-4">

        {/* Back link */}
        <a
          href="/"
          className="self-start text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          ← Back to games
        </a>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 flex flex-col gap-7">

          {/* Header */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-800">Account Settings</h1>
            <p className="text-sm text-gray-500">Update your username and country.</p>
          </div>

          {/* Current profile summary */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">Username</span>
              <span className="text-sm font-semibold text-gray-800">{savedUsername || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">Country</span>
              <span className="text-sm text-gray-800 flex items-center gap-1.5">
                {savedCountry ? (
                  <>
                    <img
                      src={`https://flagcdn.com/w40/${getCountryCode(savedCountry)?.toLowerCase()}.png`}
                      alt={savedCountry}
                      className="w-5 h-auto rounded-sm"
                    />
                    {savedCountry}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>

          {/* Success banner */}
          {saveSuccess && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
              Changes saved successfully.
            </div>
          )}

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
                onChange={(e) => {
                  setSubmitError(null);
                  setSaveSuccess(false);
                  setUsername(e.target.value);
                }}
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
              {formatErr && <p className="text-xs text-red-600">{formatErr}</p>}
              {!formatErr && takenErr && <p className="text-xs text-red-600">{takenErr}</p>}
              {!formatErr && !takenErr && checkingUsername && (
                <p className="text-xs text-gray-400">Checking availability…</p>
              )}
              {!formatErr && !takenErr && !checkingUsername && USERNAME_RE.test(username) && username !== savedUsername && (
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
                  onChange={(e) => {
                    setSubmitError(null);
                    setSaveSuccess(false);
                    setCountry(e.target.value);
                  }}
                  className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option value="">Select your country…</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <path d="M4 6l4 4 4-4H4Z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Submit error */}
            {submitError && <p className="text-xs text-red-600">{submitError}</p>}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-2.5 rounded-xl bg-gray-800 text-white font-semibold text-sm
                         hover:bg-gray-900 active:bg-black transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
