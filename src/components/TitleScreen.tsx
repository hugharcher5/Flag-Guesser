"use client";

import type { AppMode } from "@/components/NavBar";
import ModeIcon from "@/components/ModeIcon";
import Icon from "@/components/Icon";
import SignInButton from "@/components/auth/SignInButton";
import countries from "@/data/countries";
import landmarks from "@/data/landmarks";

type Mode = { key: AppMode; title: string; blurb: string; plate: string };
/** Viewport point the transition grows from. */
export type Origin = { x: number; y: number };
type OnSelect = (mode: AppMode, origin: Origin) => void;

// Each mode carries an atlas-plate caption: the facts of the round in small mono
const MODES: Record<AppMode, Mode> = {
  flag: { key: "flag", title: "Flag Quiz", blurb: "Name the world's flags", plate: `${countries.length} flags · 15:00` },
  silhouette: { key: "silhouette", title: "Guess the Border", blurb: "Countries from their outline", plate: "6 guesses" },
  globe: { key: "globe", title: "Globe Guesser", blurb: "Find it on the globe", plate: `${countries.length} countries` },
  capital: { key: "capital", title: "Capital Quiz", blurb: "Every capital city", plate: "15:00" },
  landmark: { key: "landmark", title: "Landmark Guesser", blurb: "Pin famous landmarks", plate: `${landmarks.length} landmarks` },
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
      className={`group flex min-h-[76px] w-full cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.08] bg-gray-100 p-4 text-left transition-colors duration-150 ease-out hover:border-gold-500/40 hover:bg-gray-200 active:scale-[0.99] touch-manipulation ${className}`}
    >
      <ModeIcon mode={mode.key} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-gray-900">{mode.title}</span>
        <span className="mt-1 block text-sm text-gray-500">{mode.blurb}</span>
        <span className="plate mt-2 flex items-center gap-2 whitespace-nowrap">
          <span className="plate-rule w-3" aria-hidden />
          {mode.plate}
        </span>
      </span>
      <span className="text-gray-400 transition-colors duration-150 group-hover:text-gold-500">
        <Icon name="chevron-right" className="h-4 w-4" />
      </span>
    </button>
  );
}

const link =
  "inline-flex min-h-[44px] items-center px-3 text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900";

export default function TitleScreen({
  onSelect,
  isSignedIn,
}: {
  onSelect: OnSelect;
  isSignedIn: boolean;
}) {
  // The grail artwork is the screen's one bright moment. It is a transparent cutout,
  // so it sits straight on the page with no box, lifted by a soft ink contact shadow.
  const logo = (sizing: string) => (
    <div className="flex justify-center">
      <img
        src="/geograil-hero-cutout.webp"
        alt="GeoGrail"
        width={834}
        height={909}
        fetchPriority="high"
        className={`max-w-none select-none drop-shadow-[0_28px_40px_rgba(4,5,20,0.7)] ${sizing}`}
      />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-ink text-gray-900">
      {/* Top bar */}
      <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-1 px-4 pt-4">
        <a href="/leaderboard" className={link}>
          Leaderboards
        </a>
        {isSignedIn ? (
          <a href="/stats" className={link}>
            My stats
          </a>
        ) : (
          <SignInButton />
        )}
      </div>

      {/* Mobile and tablet: logo on top, cards below */}
      <div className="lg:hidden">
        <div className="pt-2 pb-4">{logo("w-[min(460px,82vw,50vh)]")}</div>
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

      {/* Desktop: the grail centre stage, modes around it */}
      <div className="mx-auto hidden min-h-[calc(100dvh-64px)] max-w-[1600px] flex-col justify-center px-8 pb-12 lg:flex">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-8 xl:gap-12">
          <div className="flex w-full max-w-[360px] flex-col gap-4 justify-self-end">
            {LEFT.map((k) => (
              <ModeCard key={k} mode={MODES[k]} onSelect={onSelect} />
            ))}
          </div>
          {logo("w-[min(620px,42vw,70vh)]")}
          <div className="flex w-full max-w-[360px] flex-col gap-4 justify-self-start">
            {RIGHT.map((k) => (
              <ModeCard key={k} mode={MODES[k]} onSelect={onSelect} />
            ))}
          </div>
        </div>
        <div className="mx-auto mt-4 w-full max-w-[360px]">
          <ModeCard mode={MODES.landmark} onSelect={onSelect} />
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <span className="plate-rule" aria-hidden />
          <p className="text-center text-sm text-gray-500">
            Flags, borders, the globe, capitals and landmarks. How well do you know the world?
          </p>
        </div>
      </div>
    </div>
  );
}
