import type { Config } from "tailwindcss";

// GeoGrail theme: an old atlas read by lamplight.
// Ink-indigo neutrals taken from the logo's night backdrop, gold leaf as the one accent.
// The neutral and status scales are inverted (50 = darkest, 900 = lightest),
// so light-theme classes like `bg-gray-50 text-gray-900` render as parchment text on ink.
// `blue` is the accent slot used across the app; it now holds gold, so `bg-blue-600`
// is a gold fill (dark ink text on it) and `text-blue-600` is gold ink on dark.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#16172F",
        ink: "#0C0F38",
        gold: { 300: "#F3DDA0", 400: "#EDCB78", 500: "#E2B85A", 600: "#C99E3E" },
        gray: {
          50: "#0F1029",
          100: "#16172F",
          200: "#22233D",
          300: "#33344F",
          400: "#8E8FA8",
          500: "#A5A6BC",
          600: "#BEBFD0",
          700: "#D3D3DF",
          800: "#E6E4E0",
          900: "#F4F1EA",
          950: "#FFFFFF",
        },
        blue: {
          50: "#1C1D38",
          100: "#25263F",
          200: "#3A3426",
          300: "#7A6230",
          400: "#EDCB78",
          500: "#E2B85A",
          600: "#E2B85A",
          700: "#EDCB78",
          800: "#C99E3E",
          900: "#8A6A26",
        },
        green: {
          50: "#10241F",
          100: "#14312A",
          200: "#1A4438",
          300: "#256B55",
          400: "#6FD3A6",
          500: "#4FBF8F",
          600: "#3FA87B",
          700: "#7FDBB1",
          800: "#A8E8CB",
          900: "#D2F4E4",
        },
        red: {
          50: "#2A1420",
          100: "#3A1A28",
          200: "#52222F",
          300: "#80303F",
          400: "#F2909C",
          500: "#E36A7A",
          600: "#D45467",
          700: "#F2909C",
          800: "#F7B6BE",
          900: "#FBDCE0",
        },
        amber: {
          50: "#29210F",
          100: "#372C14",
          200: "#4E3E1B",
          300: "#806328",
          400: "#EDCB78",
          500: "#E2B85A",
          600: "#C99E3E",
          700: "#EDCB78",
          800: "#F3DDA0",
          900: "#FAEFCF",
        },
      },
      fontFamily: {
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
