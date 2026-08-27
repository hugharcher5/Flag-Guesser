import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoGrail",
  description: "Test your geography knowledge across flags, borders, capitals, the globe, and landmarks",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6B1024",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning={true} className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
