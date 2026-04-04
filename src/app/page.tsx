"use client";

import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import SignInButton from "@/components/auth/SignInButton";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AppMode } from "@/components/NavBar";
import PracticeMode from "@/components/PracticeMode";
import SpeedQuizMode from "@/components/SpeedQuizMode";
import SilhouetteMode from "@/components/worldle/SilhouetteMode";
import GlobeMode from "@/components/globe/GlobeMode";

export default function Page() {
  const [mode, setMode] = useState<AppMode>("practice");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50">
      <NavBar mode={mode} onModeChange={setMode} />
      {/* Auth strip — sign-in prompt or signed-in indicator */}
      <div className="flex justify-end items-center px-4 py-2 bg-white border-b border-gray-100">
        {user ? (
          <span className="text-xs text-gray-500">
            Signed in as <span className="font-medium text-gray-700">{user.email}</span>
          </span>
        ) : (
          <SignInButton />
        )}
      </div>
      <main className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:py-10">
        {mode === "practice" ? (
          <PracticeMode />
        ) : mode === "speed" ? (
          <SpeedQuizMode />
        ) : mode === "silhouette" ? (
          <SilhouetteMode />
        ) : (
          <GlobeMode />
        )}
      </main>
    </div>
  );
}
