'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Snapchat|Instagram|FBAN|FBAV|TikTok|musical_ly|BytedanceWebview|Twitter|Line|WeChat|MicroMessenger/i.test(ua)
    || (ua.includes('wv') && ua.includes('Android'));
}

export default function SignInButton() {
  const [error, setError] = useState('');
  const [showInAppWarning, setShowInAppWarning] = useState(false);

  const handleSignIn = async () => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
      return;
    }
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={handleSignIn}
        className="flex items-center gap-2.5 px-4 py-2 rounded-lg border border-gray-300
                   bg-white text-gray-700 text-sm font-medium shadow-sm
                   hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
      >
        {/* Google G logo */}
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
          <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"/>
        </svg>
        Sign in with Google
      </button>

      {showInAppWarning && (
        <div className="mt-1 w-72 rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="text-lg leading-none mt-0.5">🌐</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">Open in your browser to sign in</p>
                <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                  Google doesn&apos;t allow sign-in from Snapchat or Instagram. Open this page in Chrome or Safari and you&apos;re good to go!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInAppWarning(false)}
              aria-label="Dismiss"
              className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
