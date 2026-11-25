import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { PlannerHome } from "@/components/PlannerHome";
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
 * authorization boundary. A `destination` query from a shared safety report prefills the
 * first onboarding step after sign-up.
 */
function readDestination(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string | string[] }>;
}) {
  const { userId, has } = await auth();
  if (userId === null) return <LandingPage />;
  const destination = readDestination((await searchParams).destination);
  return (
    <PlannerHome
      entitlements={entitlementsFromHas(has)}
      initialDestination={destination}
    />
  );
}
