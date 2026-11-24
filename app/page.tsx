import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { PlannerHome } from "@/components/PlannerHome";
import { entitlementsFromHas } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PlanMyTrip.health — the only health-focused trip planner",
  description:
    "Plan around your condition, your pacing, and what you can actually do each day. A deterministic safety envelope, seven specialist agents, and live venue checks from TinyFish.",
  openGraph: {
    title: "PlanMyTrip.health — the health-first trip planner",
    description:
      "A trip shaped by your body, not a template. Pacing ceilings, specialist research, and live menu and room-rate checks.",
    siteName: "PlanMyTrip.health",
    type: "website",
  },
};

/**
 * Signed-out visitors get the public landing page; a signed-in visitor goes straight to
 * the planner. The page performs its own auth check, so Clerk middleware is not the
 * authorization boundary.
 */
export default async function Home() {
  const { userId, has } = await auth();
  if (userId === null) return <LandingPage />;
  return <PlannerHome entitlements={entitlementsFromHas(has)} />;
}
