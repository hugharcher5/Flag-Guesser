import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

// Fraunces: a soft, slightly quirky serif that matches the GeoGrail wordmark
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-body", axes: ["SOFT", "WONK", "opsz"] });

export const metadata: Metadata = {
  title: "GeoGrail",
  description: "Test your geography knowledge across flags, borders, capitals, the globe, and landmarks",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#110F2E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable} suppressHydrationWarning>
      <body suppressHydrationWarning={true} className="bg-gray-50 font-sans text-gray-900 antialiased">{children}</body>
    </html>
  );
}
