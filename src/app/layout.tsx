import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Fraunces: the soft serif that matches the GeoGrail wordmark, for headlines only.
// Instrument Sans for the interface, Geist Mono for figures and atlas-plate captions.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["SOFT", "WONK", "opsz"] });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "GeoGrail",
  description: "Test your geography knowledge across flags, borders, capitals, the globe, and landmarks",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F1029",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning={true} className="bg-gray-50 font-sans text-gray-900 antialiased">{children}</body>
    </html>
  );
}
