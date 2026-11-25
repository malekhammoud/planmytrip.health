import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CLERK_APPEARANCE } from "@/lib/clerkAppearance";
import { AnalyticsPageview } from "@/components/AnalyticsPageview";
import { AnalyticsAuth } from "@/components/AnalyticsAuth";
import "@fontsource/instrument-serif/400.css";
import "@fontsource-variable/hanken-grotesk/index.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanMyTrip.health — health-aware trip planning",
  description:
    "A paced day-by-day plan, a real route, live-checked places, and a clear safety envelope. Plan a trip that fits your health, energy, and budget. Planning aid only, not medical advice.",
  openGraph: {
    title: "PlanMyTrip.health — travel well, on your own terms",
    description:
      "A paced itinerary, a real route, live-checked venues, and a safety envelope built around your health profile.",
    siteName: "PlanMyTrip.health",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink">
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          proxyUrl={process.env.NEXT_PUBLIC_CLERK_PROXY_URL ?? "/__clerk"}
          afterSignOutUrl="/sign-in"
          appearance={CLERK_APPEARANCE}
        >
          <AnalyticsPageview />
          <AnalyticsAuth />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
