/**
 * Dashboard — the page users land on after signing in.
 *
 * Server component: reads the session from cookies via the Supabase server
 * client. Redirects to home if there is no active session.
 */

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import SignOutButton from '@/components/auth/SignOutButton';

export default async function Dashboard() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/');

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-8 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
          ✓
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Signed in</h1>
          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
