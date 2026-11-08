"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppMode } from "@/components/NavBar";
import { supabase } from "@/lib/supabase/client";

/** Viewport point the transition grows from. */
type Origin = { x: number; y: number };

// The cards, cut from the title artwork and straightened. Order is the wheel's order.
const CARDS: { key: AppMode; label: string }[] = [
  { key: "flag", label: "Flag Quiz" },
  { key: "silhouette", label: "Guess the Border" },
  { key: "landmark", label: "Landmark Guesser" },
  { key: "globe", label: "Globe Guesser" },
  { key: "capital", label: "Capital Quiz" },
];
const N = CARDS.length;

// The five places a card can sit, measured from the artwork (1752×897). x/y are the
// card's centre in % of the stage, s its scale against the front card, r its tilt.
const SLOTS: Record<number, { x: number; y: number; s: number }> = {
  [-2]: { x: 16.4, y: 65.2, s: 0.66 },
  [-1]: { x: 31.2, y: 66.8, s: 0.8 },
  0: { x: 50.3, y: 67.1, s: 1 },
  1: { x: 69.4, y: 66.8, s: 0.8 },
  2: { x: 84.2, y: 65.2, s: 0.66 },
};

/** Signed distance from the front slot, wrapped into -2..2. */
const offsetOf = (i: number, active: number) => ((((i - active) % N) + N + 2) % N) - 2;


export default function TitleWheel({
  onSelect,
  isSignedIn,
}: {
  onSelect: (mode: AppMode, origin: Origin) => void;
  isSignedIn: boolean;
}) {
  const [active, setActive] = useState(2); // Landmark Guesser starts in front, as in the artwork
  // A card that wraps from one end to the other is remounted so it fades in at its new
  // place instead of flying across the whole wheel.
  const prev = useRef<number[]>(CARDS.map((_, i) => offsetOf(i, 2)));
  const gen = useRef<number[]>(CARDS.map(() => 0));
  const offsets = CARDS.map((_, i) => offsetOf(i, active));
  offsets.forEach((o, i) => {
    if (Math.abs(o - prev.current[i]) > 2) gen.current[i]++;
    prev.current[i] = o;
  });

  const step = useCallback((d: number) => setActive((a) => (a + d + N) % N), []);

  const play = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    onSelect(CARDS[i].key, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  // Keyboard: arrows turn the wheel; Tab + Enter plays a card
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  // Mouse wheel / trackpad: one card per gesture
  const lastWheel = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = Date.now();
    if (Math.abs(d) < 12 || now - lastWheel.current < 380) return;
    lastWheel.current = now;
    step(d > 0 ? 1 : -1);
  };

  // Swipe / drag: a horizontal flick turns the wheel and cancels the click
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => (drag.current = { x: e.clientX, moved: false });
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 40) {
      d.moved = true;
      step(dx < 0 ? 1 : -1);
    }
  };

  const stats = async () => {
    if (isSignedIn) return (window.location.href = "/stats");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div
      className="relative aspect-[1752/897] w-[min(100%,calc(100dvh*1.953))] select-none touch-pan-y [container-type:inline-size]"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <img
        src="/title2/bg.webp"
        alt=""
        aria-hidden
        width={1752}
        height={897}
        fetchPriority="high"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <h1 className="sr-only">GeoGrail</h1>

      {/* Leaderboard and My Stats: a gold-rimmed navy pill */}
      <div className="title-pill absolute left-[76.05%] top-[5.05%] z-30 flex h-[6.65%] w-[22.15%] rounded-full p-[0.17cqw]">
        <div className="flex h-full w-full items-center rounded-full bg-[radial-gradient(120%_160%_at_50%_0%,#123279_0%,#0A1D57_55%,#06123F_100%)] shadow-[inset_0_1px_0_rgba(255,226,150,0.25),inset_0_-6px_12px_rgba(0,0,0,0.35)]">
          <a href="/leaderboard" className="pill-half group flex h-full flex-[1.12] items-center justify-center gap-[0.75cqw] rounded-l-full">
            <svg viewBox="0 0 24 24" aria-hidden className="pill-icon h-[2.45cqw] w-[2.45cqw]">
              <defs>
                <linearGradient id="gold-t" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFE9A6" />
                  <stop offset="0.5" stopColor="#F4B93A" />
                  <stop offset="1" stopColor="#C9821C" />
                </linearGradient>
              </defs>
              <path fill="url(#gold-t)" d="M6 3h12v2h3v3a5 5 0 0 1-4.6 5A5.5 5.5 0 0 1 13 15.9V18h3v2.5H8V18h3v-2.1A5.5 5.5 0 0 1 7.6 13 5 5 0 0 1 3 8V5h3V3Zm0 4H5v1a3 3 0 0 0 1.4 2.5A7 7 0 0 1 6 8V7Zm12 0v1c0 .9-.1 1.7-.4 2.5A3 3 0 0 0 19 8V7h-1Z" />
              <rect x="7" y="20.5" width="10" height="1.8" rx=".6" fill="#B87618" />
            </svg>
            <span className="pill-text font-serif text-[1.42cqw] leading-none text-[#F6F1E4]">Leaderboard</span>
          </a>
          <span aria-hidden className="h-[46%] w-px bg-gradient-to-b from-transparent via-[#E9B949] to-transparent" />
          <button
            onClick={stats}
            aria-label={isSignedIn ? "My stats" : "Sign in to see my stats"}
            className="pill-half group flex h-full flex-1 cursor-pointer items-center justify-center gap-[0.75cqw] rounded-r-full"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="pill-icon h-[2.3cqw] w-[2.3cqw]">
              <circle cx="12" cy="7.5" r="4.6" fill="url(#gold-t)" />
              <path fill="url(#gold-t)" d="M3.5 21.5c0-4.6 3.8-8 8.5-8s8.5 3.4 8.5 8v.5h-17v-.5Z" />
            </svg>
            <span className="pill-text font-serif text-[1.42cqw] leading-none text-[#F6F1E4]">My Stats</span>
          </button>
        </div>
      </div>

      {/* Gold arrows either side of the wheel */}
      {([-1, 1] as const).map((d) => (
        <button
          key={d}
          onClick={() => step(d)}
          aria-label={d < 0 ? "Previous game mode" : "Next game mode"}
          className={`title-arrow group absolute top-[60.75%] z-30 aspect-square w-[4.05%] cursor-pointer rounded-full p-[0.28cqw] ${
            d < 0 ? "left-[3.37%]" : "left-[92.58%]"
          }`}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_40%_30%,#173A86_0%,#0B2160_60%,#071644_100%)] shadow-[inset_0_2px_4px_rgba(255,220,140,0.15),inset_0_-4px_8px_rgba(0,0,0,0.45)]">
            <svg viewBox="0 0 100 100" aria-hidden className={`arrow-head h-[60%] w-[60%] ${d > 0 ? "-scale-x-100" : ""}`}>
              <defs>
                <linearGradient id={`gold-a${d}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FFE7A0" />
                  <stop offset="0.55" stopColor="#F2B53A" />
                  <stop offset="1" stopColor="#D08A1E" />
                </linearGradient>
              </defs>
              <path
                fill={`url(#gold-a${d})`}
                stroke="#B9781A"
                strokeWidth="2"
                strokeLinejoin="round"
                d="M74 12c4-3 9 1 7 6L66 50l15 32c2 5-3 9-7 6L18 54c-3-2-3-6 0-8L74 12Z"
              />
            </svg>
          </span>
        </button>
      ))}

      {/* The wheel */}
      <div role="listbox" aria-label="Game modes" className="pointer-events-none absolute inset-0">
        {CARDS.map((c, i) => {
          const o = offsets[i];
          const slot = SLOTS[o];
          const front = o === 0;
          return (
            <button
              key={`${c.key}-${gen.current[i]}`}
              role="option"
              aria-selected={front}
              aria-label={`Play ${c.label}`}
              onClick={(e) => {
                if (drag.current?.moved) return;
                play(i, e.currentTarget);
              }}
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                zIndex: 10 - Math.abs(o) * 2,
                transform: `translate(-50%, -50%) scale(${slot.s})`,
              }}
              className="wheel-card group pointer-events-auto absolute block aspect-[1.3] w-[18.6%] cursor-pointer rounded-[1.7cqw] transition-[left,top,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            >
              {/* Gold frame around a painted picture, the mode's name on a navy banner */}
              <span
                className={`absolute inset-0 rounded-[1.7cqw] bg-[linear-gradient(155deg,#FFF0B8_0%,#E9B949_28%,#A8721F_55%,#F5CF6A_80%,#B9802A_100%)] p-[3.2%] transition-[filter] duration-300 ${
                  front ? "wheel-front" : "brightness-[0.9] shadow-[0_8px_18px_rgba(0,10,45,0.55)] group-hover:brightness-110"
                }`}
              >
                <span className="relative block h-full w-full overflow-hidden rounded-[1.25cqw] bg-[#0A2468] shadow-[inset_0_0_0_1.5px_rgba(20,30,70,0.7)]">
                  <img
                    src={`/title2/art-${c.key}.webp`}
                    alt=""
                    draggable={false}
                    className="absolute inset-x-0 top-0 h-[76%] w-full object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 flex h-[38%] items-center justify-center bg-[linear-gradient(180deg,rgba(10,36,104,0)_0%,#0B2A74_30%,#081E5C_100%)] px-[6%] pt-[6%] text-center font-serif text-[1.8cqw] font-semibold leading-[1.05] text-white [text-shadow:0_2px_3px_rgba(0,8,40,0.8)]">
                    {c.label}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
