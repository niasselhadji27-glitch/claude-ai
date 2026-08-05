import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdVault Studio — Meta Ads Spy & AI Video Generation",
  description:
    "Scrape winning Meta ads, save them to your swipe file, and generate new AI-powered video variations in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
