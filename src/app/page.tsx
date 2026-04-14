"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import SignInButton from "@/components/auth/SignInButton";
import { supabase } from "@/lib/supabase/client";
import type { User, UserResponse, Session } from "@supabase/supabase-js";
import type { AppMode } from "@/components/NavBar";
import FlagGuesserMode from "@/components/FlagGuesserMode";
import SilhouetteMode from "@/components/worldle/SilhouetteMode";
import GlobeMode from "@/components/globe/GlobeMode";

export default function Page() {
  const [mode, setMode] = useState<AppMode>("flag");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: UserResponse) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_: string, session: Session | null) => setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50">
      <NavBar mode={mode} onModeChange={setMode} isSignedIn={!!user} />
      {/* Auth strip — sign-in prompt or signed-in indicator */}
      <div className="flex justify-end items-center px-4 py-2 bg-white border-b border-gray-100">
        {user ? (
          <div className="flex items-center gap-3">
            <a href="/stats" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              My Stats
            </a>
            <span className="text-xs text-gray-500">
              {user.email}
            </span>
          </div>
        ) : (
          <SignInButton />
        )}
      </div>
      <main className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:py-10">
        {mode === "flag" ? (
          <FlagGuesserMode />
        ) : mode === "silhouette" ? (
          <SilhouetteMode />
        ) : (
          <GlobeMode />
        )}
      </main>
    </div>
  );
}
