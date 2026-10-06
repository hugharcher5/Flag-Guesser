import type { Config } from "tailwindcss";

// GeoGrail dark theme.
// The neutral and status scales are inverted (50 = darkest tint, 900 = lightest),
// so existing light-theme classes like `bg-gray-50 text-gray-900` render as
// light text on deep purple without touching every component.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#1C1946",
        gold: { 300: "#F8E1A0", 400: "#F5D37A", 500: "#E6BC57", 600: "#D4A63A" },
        gray: {
          50: "#110F2E",
          100: "#1B1846",
          200: "#2B2763",
          300: "#3D3880",
          400: "#8C87C2",
          500: "#A9A5D6",
          600: "#C0BCE6",
          700: "#D4D1F1",
          800: "#E6E4F9",
          900: "#F5F4FF",
          950: "#FFFFFF",
        },
        blue: {
          50: "#262062",
          100: "#2F2878",
          200: "#40369C",
          300: "#5A4BC4",
          400: "#A893FF",
          500: "#8B6CFF",
          600: "#7A58F5",
          700: "#6845E0",
          800: "#5536C2",
          900: "#3F2896",
        },
        green: {
          50: "#0F2A24",
          100: "#123A30",
          200: "#175041",
          300: "#1F7A5E",
          400: "#4ADE9B",
          500: "#2FC385",
          600: "#22A06B",
          700: "#5BE3A7",
          800: "#8AEDC1",
          900: "#C2F7DE",
        },
        red: {
          50: "#33142A",
          100: "#451A35",
          200: "#5E2142",
          300: "#8E2D50",
          400: "#FF8BA0",
          500: "#F2557A",
          600: "#E03E66",
          700: "#FF8BA0",
          800: "#FFB3C1",
          900: "#FFD9E0",
        },
        amber: {
          50: "#2E2414",
          100: "#3D2F17",
          200: "#56411C",
          300: "#8A6A26",
          400: "#F5D37A",
          500: "#E6BC57",
          600: "#D4A63A",
          700: "#F5D37A",
          800: "#F8E1A0",
          900: "#FCEFCC",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
