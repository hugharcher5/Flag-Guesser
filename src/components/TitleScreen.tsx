"use client";

import type { AppMode } from "@/components/NavBar";
import ModeIcon from "@/components/ModeIcon";
import Icon from "@/components/Icon";
import SignInButton from "@/components/auth/SignInButton";

type Mode = { key: AppMode; title: string; blurb: string };
/** Viewport point the transition grows from. */
export type Origin = { x: number; y: number };
type OnSelect = (mode: AppMode, origin: Origin) => void;

const MODES: Record<AppMode, Mode> = {
  flag: { key: "flag", title: "Flag Quiz", blurb: "Name the world's flags" },
  silhouette: { key: "silhouette", title: "Guess the Border", blurb: "Countries from their outline" },
  globe: { key: "globe", title: "Globe Guesser", blurb: "Find it on the globe" },
  capital: { key: "capital", title: "Capital Quiz", blurb: "Every capital city" },
  landmark: { key: "landmark", title: "Landmark Guesser", blurb: "Pin famous landmarks" },
};

const LEFT: AppMode[] = ["flag", "silhouette"];
const RIGHT: AppMode[] = ["globe", "capital"];
const ALL: AppMode[] = ["flag", "silhouette", "globe", "capital", "landmark"];

function ModeCard({ mode, onSelect, className = "" }: { mode: Mode; onSelect: OnSelect; className?: string }) {
  return (
    <button
      onClick={(e) => {
        // Keyboard activation has no pointer position, so grow from the card's centre
        const r = e.currentTarget.getBoundingClientRect();
        onSelect(
          mode.key,
          e.detail === 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY },
        );
      }}
      className={`group relative flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-white/10 bg-[#1C1946]/75 p-4 text-left shadow-[0_12px_32px_rgba(5,3,30,0.45)] backdrop-blur-md transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-gold-400/70 hover:bg-[#262062]/85 hover:shadow-[0_16px_40px_rgba(5,3,30,0.55),0_0_0_1px_rgba(245,211,122,0.15)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 touch-manipulation lg:p-5 ${className}`}
    >
      <ModeIcon mode={mode.key} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-white transition-colors group-hover:text-gold-300 lg:text-lg">
          {mode.title}
        </span>
        <span className="mt-0.5 block text-sm text-gray-500">{mode.blurb}</span>
      </span>
      <span className="text-gray-400 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-gold-400 motion-reduce:transition-none">
        <Icon name="chevron-right" className="h-5 w-5" />
      </span>
    </button>
  );
}

const pill =
  "inline-flex min-h-[40px] items-center rounded-full border border-white/15 bg-white/5 px-4 text-gray-800 backdrop-blur-sm transition-colors hover:border-gold-400/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400";

export default function TitleScreen({
  onSelect,
  isSignedIn,
}: {
  onSelect: OnSelect;
  isSignedIn: boolean;
}) {
  const logo = (sizing: string) => (
    <div className="relative flex justify-center">
      {/* Gold halo behind the chalice */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,211,122,0.22)_0%,rgba(139,108,255,0.12)_45%,transparent_70%)] blur-2xl"
      />
      <img
        src="/geograil-hero.webp"
        alt="GeoGrail"
        width={1040}
        height={980}
        className={`hero-mask relative max-w-none select-none drop-shadow-[0_24px_48px_rgba(5,3,30,0.6)] motion-safe:animate-float ${sizing}`}
      />
    </div>
  );

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0D0C29] text-white">
      {/* Backdrop: deep purple vignette with a faint star field */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#33247A_0%,#1B1650_42%,#0D0C29_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_50%_40%,black_10%,transparent_70%)]"
      />

      {/* Top bar */}
      <div className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-end gap-2 px-4 pt-4 text-sm">
        <a href="/leaderboard" className={pill}>
          Leaderboards
        </a>
        {isSignedIn ? (
          <a href="/stats" className={pill}>
            My Stats
          </a>
        ) : (
          <SignInButton />
        )}
      </div>

      {/* Mobile and tablet: logo on top, cards below */}
      <div className="relative z-10 lg:hidden">
        <div className="-mt-2">{logo("w-[min(560px,96vw,58vh)]")}</div>
        <div className="mx-auto grid max-w-2xl gap-3 px-4 pb-12 pt-2 sm:grid-cols-2">
          {ALL.map((k, i) => (
            <ModeCard
              key={k}
              mode={MODES[k]}
              onSelect={onSelect}
              className={i === ALL.length - 1 ? "sm:col-span-2 sm:mx-auto sm:max-w-sm" : ""}
            />
          ))}
        </div>
      </div>

      {/* Desktop: big logo centre stage, modes around it */}
      <div className="relative z-10 mx-auto hidden min-h-[calc(100dvh-56px)] max-w-[1600px] flex-col justify-center px-6 pb-10 lg:flex">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 xl:gap-10">
          <div className="flex flex-col gap-5 justify-self-end w-full max-w-[340px]">
            {LEFT.map((k) => (
              <ModeCard key={k} mode={MODES[k]} onSelect={onSelect} />
            ))}
          </div>
          {logo("w-[min(680px,46vw,74vh)]")}
          <div className="flex flex-col gap-5 justify-self-start w-full max-w-[340px]">
            {RIGHT.map((k) => (
              <ModeCard key={k} mode={MODES[k]} onSelect={onSelect} />
            ))}
          </div>
        </div>
        <div className="mx-auto -mt-2 w-full max-w-[340px]">
          <ModeCard mode={MODES.landmark} onSelect={onSelect} />
        </div>
        <p className="mt-8 text-center text-sm text-gray-500">
          Flags, borders, the globe, capitals and landmarks. How well do you know the world?
        </p>
      </div>
    </div>
  );
}
