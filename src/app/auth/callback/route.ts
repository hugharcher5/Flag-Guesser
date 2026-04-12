/**
 * OAuth callback handler.
 *
 * After the user approves the Google sign-in, Supabase redirects here with a
 * one-time `code` query parameter. This route exchanges that code for a session
 * (stored as cookies) and then forwards the user to /dashboard.
 *
 * New users whose profile is not yet set up are sent to /auth/setup first.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback error:', error.message);
      return NextResponse.redirect(`${origin}/?auth_error=1`);
    }

    // Redirect new users to onboarding if they haven't completed profile setup.
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('setup_complete')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile?.setup_complete) {
        return NextResponse.redirect(`${origin}/auth/setup`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
