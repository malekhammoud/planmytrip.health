import { readBilling } from "@/lib/billing/server";
import { planLabel } from "@/lib/billing/plans";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Callout, LinkButton } from "@/components/ui";
import { listSavedTrips } from "@/lib/db/savedTrips";
import { CONDITION_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved trips - PlanMyTrip.health",
};

function savedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date not recorded";
  return date.toISOString().slice(0, 10);
}

/** The account-owned trip list. Only summaries are read here. */
export default async function SavedTripsPage() {
  const { userId, entitlements } = await readBilling();
  if (userId === null) redirect("/sign-in");

  let trips: Awaited<ReturnType<typeof listSavedTrips>> = [];
  let failed = false;
  try {
    trips = await listSavedTrips(userId);
  } catch {
    failed = true;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-container flex-1 pt-12 md:pt-20">
        <p className="t-label text-muted">Account</p>
        <h1 className="t-display measure mt-3">Saved trips.</h1>
        <p className="t-body measure mt-5 text-muted">
          These are the plans you saved while signed in. The snapshot keeps the trip,
          the concierge plan, and the safety envelope. Live verification is not stored.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LinkButton href="/" variant="secondary">
            Plan a new trip
          </LinkButton>
          <LinkButton href="/pricing" variant="ghost">
            {planLabel(entitlements.plan)} plan · See plans
          </LinkButton>
        </div>
        {entitlements.savedTripLimit !== null &&
        trips.length >= entitlements.savedTripLimit ? (
          <p className="t-small mt-3 text-muted">
            The Free Preview includes {entitlements.savedTripLimit} saved trip. Upgrade to
            keep more than one plan.
          </p>
        ) : null}

        {failed ? (
          <div className="mt-10">
            <Callout tone="caution" title="Saved trips could not be read">
              The account store is not reachable right now. Try again in a moment.
            </Callout>
          </div>
        ) : trips.length === 0 ? (
          <div className="mt-10 border-t border-hairline pt-6">
            <h2 className="t-title">No saved trips yet.</h2>
            <p className="t-small measure mt-2 text-muted">
              Build a plan, then choose Save trip in the command bar. A saved trip can be
              reopened from this page.
            </p>
          </div>
        ) : (
          <ol aria-label="Saved trips" className="mt-10 list-none p-0">
            {trips.map((trip) => (
              <li
                key={trip.id}
                className="border-t border-hairline py-6 md:flex md:items-end md:justify-between md:gap-8"
              >
                <div className="min-w-0">
                  <p className="t-label text-muted">
                    {CONDITION_LABELS[trip.condition]}
                  </p>
                  <h2 className="t-title mt-1 [overflow-wrap:anywhere]">
                    {trip.destination}
                  </h2>
                  <p className="t-data-sm mt-1 text-muted">
                    {trip.days} days · saved {savedDate(trip.savedAt)}
                  </p>
                </div>
                <div className="mt-4 shrink-0 md:mt-0">
                  <LinkButton href={`/trips/${trip.id}`} variant="secondary">
                    Open saved trip
                  </LinkButton>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
