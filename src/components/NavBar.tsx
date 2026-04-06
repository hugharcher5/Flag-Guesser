"use client";

export type AppMode = "practice" | "speed" | "silhouette" | "globe";

interface NavBarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const TABS: { key: AppMode; label: string }[] = [
  { key: "practice", label: "Practice" },
  { key: "speed", label: "Speed Quiz" },
  { key: "silhouette", label: "Shape Guesser" },
  { key: "globe", label: "Globe Guesser" },
];

export default function NavBar({ mode, onModeChange }: NavBarProps) {
  return (
    <nav className="w-full bg-white border-b border-gray-200">
      <div className="max-w-md mx-auto flex" suppressHydrationWarning>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onModeChange(key)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors touch-manipulation ${
              mode === key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
