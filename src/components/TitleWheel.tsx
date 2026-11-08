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

const hit = "absolute cursor-pointer rounded-full focus-visible:outline-offset-2";

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

      {/* The gold pill in the artwork: Leaderboard and My Stats */}
      <a href="/leaderboard" aria-label="Leaderboard" className={`${hit} left-[76.4%] top-[5.2%] h-[6.6%] w-[11.8%]`} />
      <button onClick={stats} aria-label={isSignedIn ? "My stats" : "Sign in to see my stats"} className={`${hit} left-[88.3%] top-[5.2%] h-[6.6%] w-[9.9%]`} />

      {/* The painted arrows either side of the wheel */}
      <button onClick={() => step(-1)} aria-label="Previous game mode" className={`${hit} left-[3.2%] top-[60.2%] h-[8.4%] w-[4.3%]`} />
      <button onClick={() => step(1)} aria-label="Next game mode" className={`${hit} left-[92.4%] top-[60.2%] h-[8.4%] w-[4.3%]`} />

      {/* The wheel */}
      <div role="listbox" aria-label="Game modes" className="absolute inset-0">
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
              className="wheel-card group absolute block aspect-[1.3] w-[18.6%] cursor-pointer rounded-[1.7cqw] transition-[left,top,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
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
