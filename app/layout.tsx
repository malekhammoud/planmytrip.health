import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/instrument-serif/400.css";
import "@fontsource-variable/hanken-grotesk/index.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanMyTrip.health",
  description:
    "A health-first travel planner that paces each day to a medical condition and verifies live travel risk.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink">{children}</body>
    </html>
  );
}
