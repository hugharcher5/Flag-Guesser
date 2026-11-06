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

const ALL: AppMode[] = ["flag", "silhouette", "globe", "capital", "landmark"];

// Where each splash lands, as the centre of its button in % of the desktop stage
const SPOTS: { key: AppMode; x: number; y: number }[] = [
  { key: "flag", x: 17.2, y: 74 },
  { key: "silhouette", x: 29.4, y: 55.5 },
  { key: "globe", x: 67.4, y: 54.5 },
  { key: "capital", x: 83, y: 69 },
  { key: "landmark", x: 49.6, y: 90 },
];

// Puddle outlines, drawn in a 240×100 box and stretched to each label. Three variants
// so neighbouring puddles never look stamped from one mould.
const PUDDLES = [
  "M18,54 C6,36 26,16 54,20 C72,8 100,14 118,12 C144,6 172,14 192,20 C218,16 238,34 230,54 C240,72 220,88 194,84 C174,96 144,90 122,92 C96,97 68,92 50,86 C24,92 8,72 18,54 Z",
  "M14,48 C10,28 34,14 60,18 C84,10 108,18 130,12 C156,8 186,12 204,22 C228,26 236,44 228,58 C232,78 210,90 184,86 C160,94 134,88 112,92 C86,96 60,94 40,84 C18,82 6,64 14,48 Z",
  "M22,50 C12,30 36,18 58,22 C80,12 104,10 126,16 C150,10 178,16 198,24 C224,26 236,46 226,60 C230,80 204,90 180,84 C156,92 128,94 104,90 C80,94 52,90 36,80 C14,76 10,62 22,50 Z",
];
// Stray droplets around each puddle, as % of the button box: [x, y, size px]
const DROPS: [number, number, number][][] = [
  [[-4, 70, 7], [103, 30, 5], [96, 96, 4]],
  [[104, 64, 7], [-3, 26, 5], [8, 100, 4]],
  [[-5, 44, 6], [102, 82, 6], [90, -6, 4]],
];

/** A mode button shaped as the puddle at the end of a splash: glossy water, light text on it. */
function WaterButton({ mode, onSelect, x, y, variant }: { mode: Mode; onSelect: OnSelect; x: number; y: number; variant: number }) {
  const id = `water-${mode.key}`;
  return (
    <button
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSelect(
          mode.key,
          e.detail === 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY },
        );
      }}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-[40%] focus-visible:outline-offset-4"
    >
      <span className="relative flex min-h-[64px] items-center gap-3 whitespace-nowrap px-9 py-4 text-left transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.05] group-active:scale-[0.97]">
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
          <path d={PUDDLES[variant]} fill={`url(#${id}-body)`} stroke="#0A1B4D" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          {/* Rim light along the top edge and a wet glint on the left */}
          <path d={PUDDLES[variant]} fill="none" stroke="#6CC8FF" strokeOpacity="0.55" strokeWidth="1.5" vectorEffect="non-scaling-stroke" transform="translate(0 2) scale(1 0.97)" />
          <ellipse cx="120" cy="24" rx="80" ry="7" fill={`url(#${id}-shine)`} />
          <ellipse cx="208" cy="34" rx="6" ry="3.5" fill="#E6F6FF" fillOpacity="0.6" />
          {/* Ripple ring that spreads on hover */}
          <ellipse
            cx="120"
            cy="54"
            rx="96"
            ry="30"
            fill="none"
            stroke="#BFE7FF"
            strokeOpacity="0"
            vectorEffect="non-scaling-stroke"
            className="origin-center transition-[stroke-opacity,transform] duration-500 ease-out [transform-box:fill-box] [transform:scale(0.7)] group-hover:[stroke-opacity:0.35] group-hover:[transform:scale(1)]"
          />
        </svg>
        {DROPS[variant].map(([dx, dy, s], i) => (
          <span
            key={i}
            aria-hidden
            style={{ left: `${dx}%`, top: `${dy}%`, width: s, height: s * 0.8 }}
            className="absolute rounded-full border border-[#0A1B4D] bg-[#2A86D8]"
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
          {SPOTS.map(({ key, x, y }, i) => (
            <WaterButton key={key} mode={MODES[key]} onSelect={onSelect} x={x} y={y} variant={i % PUDDLES.length} />
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
