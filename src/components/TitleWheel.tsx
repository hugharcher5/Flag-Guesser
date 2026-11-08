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
const SLOTS: Record<number, { x: number; y: number; s: number; r: number }> = {
  [-2]: { x: 16.4, y: 64.2, s: 0.77, r: 6 },
  [-1]: { x: 30.8, y: 66.6, s: 0.85, r: 4.4 },
  0: { x: 50.3, y: 67.1, s: 1, r: 0 },
  1: { x: 69.4, y: 66.4, s: 0.85, r: -5 },
  2: { x: 83.8, y: 64.0, s: 0.77, r: -5.5 },
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
                // The landmark card is wider than the rest, so it shrinks a little more off-centre
                transform: `translate(-50%, -50%) rotate(${slot.r}deg) scale(${front || c.key !== "landmark" ? slot.s : slot.s * 0.8})`,
              }}
              className="wheel-card group absolute flex h-[27.4%] w-[21.4%] cursor-pointer items-center justify-center rounded-[13%] transition-[left,top,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            >
              <img
                src={`/title2/card-${c.key}.webp`}
                alt=""
                draggable={false}
                className={`max-h-full max-w-full object-contain transition-[filter] duration-300 ${
                  front
                    ? "wheel-front"
                    : "brightness-[0.92] group-hover:brightness-110"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
