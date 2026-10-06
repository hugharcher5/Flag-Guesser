const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  "arrow-left": <path d="M19 12H5m6-6l-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14m-6-6l6 6-6 6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
};

export type IconName = keyof typeof PATHS;

/** Inline line icon that inherits the current text colour. */
export default function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`flex-none ${className}`}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
