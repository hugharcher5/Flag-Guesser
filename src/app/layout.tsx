import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flag Guesser",
  description: "Guess the country from its flag",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
