"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import NavBar from "@/components/NavBar";
import SignInButton from "@/components/auth/SignInButton";
import { supabase } from "@/lib/supabase/client";
import type { User, UserResponse, Session } from "@supabase/supabase-js";
import type { AppMode } from "@/components/NavBar";
import FlagGuesserMode from "@/components/FlagGuesserMode";
import SilhouetteMode from "@/components/worldle/SilhouetteMode";
import GlobeMode from "@/components/globe/GlobeMode";
import CapitalGuesserMode from "@/components/CapitalGuesserMode";
import LandmarkMode from "@/components/landmark/LandmarkMode";
import TitleScreen, { type Origin } from "@/components/TitleScreen";

export default function Page() {
  const [mode, setMode] = useState<AppMode | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Deep link: /?play=flag opens a mode directly; selecting a mode updates the URL
  useEffect(() => {
    const play = new URLSearchParams(window.location.search).get("play");
    if (play && ["flag", "silhouette", "globe", "capital", "landmark"].includes(play)) {
      setMode(play as AppMode);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (mode) url.searchParams.set("play", mode);
    else url.searchParams.delete("play");
    window.history.replaceState(null, "", url);
  }, [mode]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: UserResponse) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_: string, session: Session | null) => setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  // Open a game with a circle that grows from the clicked card (View Transitions API).
  // Browsers without it, or with reduced motion on, just switch instantly.
  const openMode = (next: AppMode, { x, y }: Origin) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!("startViewTransition" in document) || reduced) {
      setMode(next);
      return;
    }
    const root = document.documentElement;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("vt-reveal");
    const transition = document.startViewTransition(() => flushSync(() => setMode(next)));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
      );
      root.animate(
        { transform: ["scale(1)", "scale(0.94)"], filter: ["brightness(1)", "brightness(0.6)"] },
        { duration: 650, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-old(root)" },
      );
    });
    transition.finished.finally(() => root.classList.remove("vt-reveal"));
  };

  if (!mode) return <TitleScreen onSelect={openMode} isSignedIn={!!user} />;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50">
      <NavBar mode={mode} onModeChange={setMode} isSignedIn={!!user} />
      {/* Auth strip — sign-in prompt or signed-in indicator */}
      <div className="flex justify-end items-center px-4 py-2 bg-surface border-b border-gray-100">
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
        ) : mode === "capital" ? (
          <CapitalGuesserMode />
        ) : mode === "landmark" ? (
          <LandmarkMode />
        ) : (
          <GlobeMode />
        )}
      </main>
    </div>
  );
}
