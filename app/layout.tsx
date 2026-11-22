import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CLERK_APPEARANCE } from "@/lib/clerkAppearance";
import "@fontsource/instrument-serif/400.css";
import "@fontsource-variable/hanken-grotesk/index.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanMyTrip.health",
  description:
    "A health-first travel planner that paces each day to a medical condition and verifies live travel risk.",
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
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
