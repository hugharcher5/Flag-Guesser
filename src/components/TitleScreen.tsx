"use client";

import { useState } from "react";
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

const ALL: AppMode[] = ["flag", "silhouette", "globe", "capital", "landmark"];

// The five puddles painted in /title/geograil-title.webp, measured from its pixels.
// Each box is in % of the 1672×941 artwork; the mask is that puddle's exact outline.
// cx: where the label centres across the puddle, clear of the wordmark and splash
const PUDDLES: { key: AppMode; x: number; y: number; w: number; h: number; cx: number }[] = [
  { key: "flag", x: 7.3, y: 61.74, w: 23.56, h: 9.35, cx: 50 },
  { key: "silhouette", x: 24.1, y: 47.82, w: 18.3, h: 9.25, cx: 40 },
  { key: "globe", x: 58.37, y: 46.65, w: 16.21, h: 9.14, cx: 60 },
  { key: "capital", x: 69.08, y: 61.32, w: 25.9, h: 10.2, cx: 50 },
  { key: "landmark", x: 37.2, y: 69.93, w: 26.2, h: 10.52, cx: 50 },
];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Droplets thrown out by a click: direction in degrees, distance in px, size, duration
const BURST = Array.from({ length: 12 }, (_, i) => {
  const r = rng(900 + i);
  return { a: i * 30 + (r() - 0.5) * 20, d: 34 + r() * 40, s: 4 + Math.round(r() * 5), t: 380 + Math.round(r() * 160) };
});

type Splash = { x: number; y: number; id: number };

/** An invisible button over one painted puddle. The label floats on the water; hover lights
 *  the puddle's own outline, and a click throws up a splash before the game opens. */
function PuddleButton({ mode, onSelect, x, y, w, h, cx }: { mode: Mode; onSelect: OnSelect; x: number; y: number; w: number; h: number; cx: number }) {
  const [splash, setSplash] = useState<Splash | null>(null);
  const mask = `url(/title/puddle-${mode.key}.png) center / 100% 100% no-repeat`;
  return (
    <button
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const origin = e.detail === 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY };
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onSelect(mode.key, origin);
        setSplash({ x: origin.x - r.left, y: origin.y - r.top, id: Date.now() });
        window.setTimeout(() => onSelect(mode.key, origin), 260);
      }}
      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
      className="group absolute cursor-pointer rounded-[50%] focus-visible:outline-offset-4"
    >
      {/* Light on the water, clipped to the puddle's painted outline */}
      <span
        aria-hidden
        style={{ WebkitMask: mask, mask }}
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(190,231,255,0.55),rgba(120,200,255,0.15)_60%,transparent_80%)] opacity-0 mix-blend-screen transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-60"
      />
      <span
        style={{ left: `${cx}%` }}
        className="absolute top-1/2 flex -translate-x-1/2 -translate-y-[42%] flex-col items-center whitespace-nowrap text-center [text-shadow:0_1px_3px_rgba(4,14,50,0.85)] transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-[52%]"
      >
        <span className="font-display text-[max(14px,1.25cqw)] font-semibold leading-tight text-[#FFF3D6] [font-variation-settings:'SOFT'_100,'WONK'_0] [text-shadow:0_1px_0_#B8862F,0_2px_4px_rgba(4,14,50,0.9)]">{mode.title}</span>
        <span className="font-display text-[max(11px,0.82cqw)] font-normal leading-tight text-[#DCEBFF]/90 [font-variation-settings:'SOFT'_100,'WONK'_0]">{mode.plate}</span>
      </span>
      {splash && (
        <span key={splash.id} aria-hidden className="pointer-events-none absolute" style={{ left: splash.x, top: splash.y }}>
          <span className="splash-ring absolute h-24 w-24 rounded-full border-2 border-[#BFE7FF]" />
          {BURST.map((b, i) => (
            <span
              key={i}
              className="splash-drop absolute rounded-full border border-[#0A1B4D] bg-[#3A9BEA]"
              style={
                {
                  width: b.s,
                  height: b.s,
                  "--dx": `${Math.cos((b.a * Math.PI) / 180) * b.d}px`,
                  "--dy": `${Math.sin((b.a * Math.PI) / 180) * b.d}px`,
                  animationDuration: `${b.t}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      )}
    </button>
  );
}

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
    <div className="min-h-[100dvh] bg-[#090C32] text-gray-900">
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

      {/* Desktop: one painted scene, the grail pouring into five puddles. Each mode is the
          puddle itself; the stage keeps the artwork's proportions and places buttons in %. */}
      <div className="mx-auto hidden justify-center px-8 pb-6 lg:flex">
        <div className="relative aspect-[1672/941] w-[min(1672px,calc((100dvh-72px)*1.777),100%)] [container-type:inline-size]">
          <img
            src="/title/geograil-title.webp"
            alt="GeoGrail"
            width={1672}
            height={941}
            fetchPriority="high"
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
          />
          {PUDDLES.map(({ key, ...box }) => (
            <PuddleButton key={key} mode={MODES[key]} onSelect={onSelect} {...box} />
          ))}
          <p className="absolute inset-x-0 top-[88%] text-center text-[max(13px,0.85cqw)] text-gray-500">
            Flags, borders, the globe, capitals and landmarks. How well do you know the world?
          </p>
        </div>
      </div>
    </div>
  );
}
