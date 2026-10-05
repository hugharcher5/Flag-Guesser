"use client";

import type { AppMode } from "@/components/NavBar";
import SignInButton from "@/components/auth/SignInButton";

const MODES: { key: AppMode; title: string; blurb: string; icon: React.ReactNode }[] = [
  {
    key: "flag",
    title: "Flag Quiz",
    blurb: "Name as many of the world's flags as you can",
    icon: (
      <path d="M5 21V4m0 0h11l-2 4 2 4H5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    key: "silhouette",
    title: "Guess the Border",
    blurb: "Identify countries from their outline",
    icon: (
      <path d="M4 7l5-3 6 3 5-2v12l-5 2-6-3-5 3V7z M9 4v13 M15 7v12" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    key: "globe",
    title: "Globe Guesser",
    blurb: "Find the country on a spinning globe",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
      </>
    ),
  },
  {
    key: "capital",
    title: "Capital Quiz",
    blurb: "Match every country to its capital city",
    icon: (
      <path d="M3 21h18M5 21V10m14 11V10M9 21v-7m6 7v-7M3 10l9-6 9 6H3z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    key: "landmark",
    title: "Landmark Guesser",
    blurb: "Place famous landmarks on the map",
    icon: (
      <>
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>
    ),
  },
];

export default function TitleScreen({
  onSelect,
  isSignedIn,
}: {
  onSelect: (mode: AppMode) => void;
  isSignedIn: boolean;
}) {
  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#2B1F66_0%,#16153F_55%,#0E0F2B_100%)] text-white">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-10 pb-16 sm:pt-14">
        <img
          src="/geograil-logo.webp"
          alt="GeoGrail"
          width={460}
          height={475}
          className="w-56 sm:w-72 h-auto drop-shadow-[0_10px_40px_rgba(245,211,122,0.25)]"
        />
        <p className="mt-4 text-center text-base sm:text-lg text-indigo-100/80">
          Test your geography across flags, borders, the globe, capitals and landmarks.
        </p>

        <div className="mt-10 flex w-full flex-wrap justify-center gap-3">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => onSelect(m.key)}
              className="group flex w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-sm transition-colors hover:border-[#F5D37A]/60 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5D37A] touch-manipulation"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-b from-[#F5D37A] to-[#D4A63A] text-[#1B1745]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden>
                  {m.icon}
                </svg>
              </span>
              <span>
                <span className="block font-semibold text-white group-hover:text-[#F5D37A] transition-colors">{m.title}</span>
                <span className="mt-0.5 block text-sm text-indigo-100/70">{m.blurb}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
          <a href="/leaderboard" className="rounded-full border border-white/15 px-4 py-2 text-indigo-100 hover:border-[#F5D37A]/60 hover:text-white transition-colors">
            Leaderboards
          </a>
          {isSignedIn ? (
            <a href="/stats" className="rounded-full border border-white/15 px-4 py-2 text-indigo-100 hover:border-[#F5D37A]/60 hover:text-white transition-colors">
              My Stats
            </a>
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </div>
  );
}
