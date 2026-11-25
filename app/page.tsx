import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { PlannerHome } from "@/components/PlannerHome";
import { safeDestination } from "@/lib/ads/campaign";
import { entitlementsFromHas } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

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

/**
 * Signed-out visitors get the public landing page; a signed-in visitor goes straight to
 * the planner. The page performs its own auth check, so Clerk middleware is not the
 * authorization boundary. A `destination` search param arrives from a house-ad link and
 * prefills the first trip step after sign-up.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string | string[] }>;
}) {
  const { userId, has } = await auth();
  if (userId === null) return <LandingPage />;
  const requested = (await searchParams).destination;
  const destination = safeDestination(
    Array.isArray(requested) ? requested[0] : requested,
  );
  return (
    <PlannerHome
      entitlements={entitlementsFromHas(has)}
      initialDestination={destination?.slice(0, 120) ?? ""}
    />
  );
}
