'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh(); // revalidates server components so they see the cleared session
  };

  return (
    <button
      onClick={handleSignOut}
      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700
                 text-sm font-medium hover:bg-gray-50 active:bg-gray-100
                 transition-colors touch-manipulation"
    >
      Sign out
    </button>
  );
}
