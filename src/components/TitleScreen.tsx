"use client";

import type { AppMode } from "@/components/NavBar";
import ModeIcon from "@/components/ModeIcon";
import SignInButton from "@/components/auth/SignInButton";

const MODES: { key: AppMode; title: string; blurb: string }[] = [
  { key: "flag", title: "Flag Quiz", blurb: "Name the world's flags" },
  { key: "silhouette", title: "Guess the Border", blurb: "Countries from their outline" },
  { key: "globe", title: "Globe Guesser", blurb: "Find it on the globe" },
  { key: "capital", title: "Capital Quiz", blurb: "Every capital city" },
  { key: "landmark", title: "Landmark Guesser", blurb: "Pin famous landmarks" },
];

export default function TitleScreen({
  onSelect,
  isSignedIn,
}: {
  onSelect: (mode: AppMode) => void;
  isSignedIn: boolean;
}) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,#2E2170_0%,#17154A_45%,#0D0C29_100%)] text-white">
      {/* Top bar */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 pt-4 text-sm">
        <a
          href="/leaderboard"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-gray-800 backdrop-blur-sm transition-colors hover:border-gold-400/60 hover:text-white"
        >
          Leaderboards
        </a>
        {isSignedIn ? (
          <a
            href="/stats"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-gray-800 backdrop-blur-sm transition-colors hover:border-gold-400/60 hover:text-white"
          >
            My Stats
          </a>
        ) : (
          <SignInButton />
        )}
      </div>

      {/* Logo as the backdrop */}
      <div className="relative -mt-6 flex justify-center sm:-mt-10">
        <img
          src="/geograil-hero.webp"
          alt="GeoGrail"
          width={1040}
          height={980}
          className="pointer-events-none w-[min(1000px,100vw,78vh)] max-w-none select-none"
        />
      </div>

      {/* Mode cards laid over the bottom of the logo */}
      <div className="relative z-10 mx-auto -mt-[min(40px,4vw,4vh)] max-w-6xl px-4 pb-14">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MODES.map((m, i) => (
            <button
              key={m.key}
              onClick={() => onSelect(m.key)}
              className={`group flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-[#1C1946]/70 p-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-400/70 hover:bg-[#241F5C]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 touch-manipulation ${
                i === MODES.length - 1 ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <ModeIcon mode={m.key} />
              <span>
                <span className="block font-semibold text-white transition-colors group-hover:text-gold-400">{m.title}</span>
                <span className="mt-0.5 block text-sm text-gray-500">{m.blurb}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-gray-500">
          Flags, borders, the globe, capitals and landmarks. How well do you know the world?
        </p>
      </div>
    </div>
  );
}
