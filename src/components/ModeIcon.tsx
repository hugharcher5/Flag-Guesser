import type { AppMode } from "@/components/NavBar";

const PATHS: Record<AppMode, React.ReactNode> = {
  flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" strokeLinecap="round" strokeLinejoin="round" />,
  silhouette: (
    <path d="M4 7l5-3 6 3 5-2v12l-5 2-6-3-5 3V7z M9 4v13 M15 7v12" strokeLinecap="round" strokeLinejoin="round" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
    </>
  ),
  capital: (
    <path d="M3 21h18M5 21V10m14 11V10M9 21v-7m6 7v-7M3 10l9-6 9 6H3z" strokeLinecap="round" strokeLinejoin="round" />
  ),
  landmark: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
};

/** Gold rounded tile with a line icon for a game mode. */
export default function ModeIcon({ mode, size = "md" }: { mode: AppMode; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-9 w-9 rounded-lg" : "h-11 w-11 rounded-xl";
  const icon = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <span className={`flex flex-none items-center justify-center bg-gradient-to-b from-gold-400 to-gold-600 text-[#1B1745] ${box}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={icon} aria-hidden>
        {PATHS[mode]}
      </svg>
    </span>
  );
}
