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

// Where each splash lands, as the centre of its button in % of the desktop stage
const SPOTS: { key: AppMode; x: number; y: number }[] = [
  { key: "flag", x: 17.2, y: 74 },
  { key: "silhouette", x: 29.4, y: 55.5 },
  { key: "globe", x: 67.4, y: 54.5 },
  { key: "capital", x: 83, y: 69 },
  { key: "landmark", x: 49.6, y: 90 },
];

// Each puddle is drawn from its own seed, so no two share an outline. Points sit round an
// ellipse in a 240×100 box with jittered radii, one or two lobes pushed out where the water
// ran, then smoothed into one closed curve. Deterministic, so server and client agree.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Puddle = { d: string; drops: [number, number, number][]; tilt: number; pad: string };

function puddle(seed: number, lobes: number[], tilt: number, pad: string): Puddle {
  const rand = rng(seed);
  const n = 16;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    let r = 0.95 + rand() * 0.14;
    for (const l of lobes) {
      const d = Math.atan2(Math.sin(a - l), Math.cos(a - l));
      r += 0.3 * Math.exp(-(d * d) / 0.1);
    }
    // A squarish ellipse (superellipse) so the label's corners stay on the water
    const c = Math.cos(a), sn = Math.sin(a);
    const sx = Math.sign(c) * Math.abs(c) ** 0.78, sy = Math.sign(sn) * Math.abs(sn) ** 0.78;
    pts.push([120 + 112 * r * sx, 50 + 46 * r * sy]);
  }
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  const drops: [number, number, number][] = [];
  const count = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.16 + rand() * 0.16;
    drops.push([((120 + 104 * r * Math.cos(a)) / 240) * 100, ((50 + 40 * r * Math.sin(a)) / 100) * 100, 3 + Math.round(rand() * 5)]);
  }
  return { d: d + " Z", drops, tilt, pad };
}

const PUDDLES: Record<AppMode, Puddle> = {
  flag: puddle(11, [3.3, 0.5], -3, "px-12 py-5"),
  silhouette: puddle(27, [4.4], 2.5, "px-11 py-6"),
  globe: puddle(43, [5.2, 1.9], -2, "px-11 py-5"),
  capital: puddle(58, [0.2], 3.5, "px-12 py-6"),
  landmark: puddle(76, [1.6, 3.9], -1.5, "px-14 py-5"),
};

// Droplets thrown out by a click: direction in degrees and distance in px
const BURST = Array.from({ length: 12 }, (_, i) => {
  const r = rng(900 + i);
  return { a: i * 30 + (r() - 0.5) * 20, d: 34 + r() * 40, s: 4 + Math.round(r() * 5), t: 380 + Math.round(r() * 160) };
});

type Splash = { x: number; y: number; id: number };

/** A mode button shaped as the puddle at the end of a splash: glossy water, light text on it. */
function WaterButton({ mode, onSelect, x, y }: { mode: Mode; onSelect: OnSelect; x: number; y: number }) {
  const id = `water-${mode.key}`;
  const shape = PUDDLES[mode.key];
  const [splash, setSplash] = useState<Splash | null>(null);
  return (
    <button
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const origin = e.detail === 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY };
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onSelect(mode.key, origin);
        // Splash first, then the game grows out of the same point
        setSplash({ x: origin.x - r.left, y: origin.y - r.top, id: Date.now() });
        window.setTimeout(() => onSelect(mode.key, origin), 260);
      }}
      style={{ left: `${x}%`, top: `${y}%`, rotate: `${shape.tilt}deg` }}
      className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-[40%] focus-visible:outline-offset-4"
    >
      <span className={`relative flex min-h-[64px] items-center gap-3 whitespace-nowrap text-left transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.05] group-active:scale-[0.97] ${shape.pad}`}>
        <svg
          viewBox="0 0 240 100"
          preserveAspectRatio="none"
          aria-hidden
          className="absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_10px_18px_rgba(4,5,20,0.6)] transition-[filter] duration-300 group-hover:brightness-110"
        >
          <defs>
            <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2E8FE0" />
              <stop offset="0.45" stopColor="#1763B8" />
              <stop offset="1" stopColor="#0E3F8A" />
            </linearGradient>
            <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E6F6FF" stopOpacity="0.45" />
              <stop offset="1" stopColor="#E6F6FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Body, with the dark ink outline the painted splashes have */}
          <path d={shape.d} fill={`url(#${id}-body)`} stroke="#0A1B4D" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          {/* Rim light along the top edge and a wet glint */}
          <path d={shape.d} fill="none" stroke="#6CC8FF" strokeOpacity="0.55" strokeWidth="1.5" vectorEffect="non-scaling-stroke" transform="translate(6 3) scale(0.95 0.94)" />
          <ellipse cx="120" cy="24" rx="78" ry="7" fill={`url(#${id}-shine)`} />
          {/* Ripple ring that spreads on hover */}
          <ellipse
            cx="120"
            cy="54"
            rx="92"
            ry="30"
            fill="none"
            stroke="#BFE7FF"
            strokeOpacity="0"
            vectorEffect="non-scaling-stroke"
            className="origin-center transition-[stroke-opacity,transform] duration-500 ease-out [transform-box:fill-box] [transform:scale(0.7)] group-hover:[stroke-opacity:0.35] group-hover:[transform:scale(1)]"
          />
        </svg>
        {shape.drops.map(([dx, dy, s], i) => (
          <span
            key={i}
            aria-hidden
            style={{ left: `${dx}%`, top: `${dy}%`, width: s, height: s * 0.8 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0A1B4D] bg-[#2A86D8]"
          />
        ))}
        <span className="relative text-[#F4F9FF]">
          <ModeIcon mode={mode.key} bare />
        </span>
        <span className="relative flex flex-col [text-shadow:0_1px_2px_rgba(6,20,60,0.6)]">
          <span className="text-[15px] font-medium leading-5 text-[#F4F9FF]">{mode.title}</span>
          <span className="font-mono text-xs leading-4 text-[#CDE8FF]">{mode.plate}</span>
        </span>
      </span>
      {/* Click splash: a ring spreads and droplets fly out from where the water was hit */}
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

      {/* Desktop: water splashes out of the grail, each mode rides one to its puddle.
          The stage keeps the artwork's proportions; every piece is placed in % of it. */}
      <div className="mx-auto hidden flex-col items-center px-8 pb-8 lg:flex">
        <div
          className="relative aspect-[1392/812] w-[min(1392px,calc((100dvh-150px)*1.714),100%)]"
        >
          <img
            src="/geograil-splashes.webp"
            alt=""
            aria-hidden
            width={1392}
            height={752}
            className="pointer-events-none absolute left-0 top-[7.39%] w-full select-none"
          />
          <img
            src="/geograil-hero-cutout.webp"
            alt="GeoGrail"
            width={834}
            height={909}
            fetchPriority="high"
            className="pointer-events-none absolute left-[30.24%] top-[4.43%] w-[40.16%] select-none drop-shadow-[0_28px_40px_rgba(4,5,20,0.7)]"
          />
          {SPOTS.map(({ key, x, y }) => (
            <WaterButton key={key} mode={MODES[key]} onSelect={onSelect} x={x} y={y} />
          ))}
        </div>
        <div className="mt-6 flex flex-col items-center gap-3">
          <span className="plate-rule" aria-hidden />
          <p className="text-center text-sm text-gray-500">
            Flags, borders, the globe, capitals and landmarks. How well do you know the world?
          </p>
        </div>
      </div>
    </div>
  );
}
