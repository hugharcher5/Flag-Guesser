import type { Config } from "tailwindcss";

// GeoGrail theme: the title screen's royal navy and gold.
// Navy neutrals taken from the title artwork, its warm gold as the one accent.
// The neutral and status scales are inverted (50 = darkest, 900 = lightest),
// so light-theme classes like `bg-gray-50 text-gray-900` render as parchment text on ink.
// `blue` is the accent slot used across the app; it now holds gold, so `bg-blue-600`
// is a gold fill (dark ink text on it) and `text-blue-600` is gold ink on dark.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0A1F5C",
        ink: "#04123D",
        gold: { 300: "#FFE7A6", 400: "#F2C766", 500: "#E9B949", 600: "#C9902A" },
        gray: {
          50: "#04123D",
          100: "#0A1F5C",
          200: "#12307A",
          300: "#1E428F",
          400: "#8FA3D1",
          500: "#A9BADF",
          600: "#C3D0EC",
          700: "#DAE2F4",
          800: "#ECEFF8",
          900: "#F6F1E4",
          950: "#FFFFFF",
        },
        blue: {
          50: "#0F2A6B",
          100: "#163478",
          200: "#4A3E1E",
          300: "#8A6A26",
          400: "#F2C766",
          500: "#E9B949",
          600: "#E9B949",
          700: "#F2C766",
          800: "#C9902A",
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
          50: "#2A2412",
          100: "#3A3016",
          200: "#4E3E1B",
          300: "#806328",
          400: "#F2C766",
          500: "#E9B949",
          600: "#C9902A",
          700: "#F2C766",
          800: "#FFE7A6",
          900: "#FFF3D1",
        },
      },
      fontFamily: {
        sans: ['"Times New Roman"', "Times", "serif"],
        serif: ['"Times New Roman"', "Times", "serif"],
        display: ['"Times New Roman"', "Times", "serif"],
        mono: ['"Times New Roman"', "Times", "serif"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
