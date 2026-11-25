import { readBilling } from "@/lib/billing/server";
import { planLabel } from "@/lib/billing/plans";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { DestinationAd } from "@/components/ads/DestinationAd";
import { Callout, LinkButton } from "@/components/ui";
import { listSavedTrips } from "@/lib/db/savedTrips";
import { signInHref } from "@/lib/redirects";
import { CONDITION_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved trips - PlanMyTrip.health",
  description: "Open a trip you saved, with its itinerary and safety envelope.",
};

const PAGE_SIZE = 30;
const MAX_PAGE = 10_000;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_PAGE);
}

function pageHref(page: number): string {
  return page <= 1 ? "/trips" : `/trips?page=${page}`;
}

function savedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date not recorded";
  return date.toISOString().slice(0, 10);
}

/** The account-owned trip list. Only summaries are read here. */
export default async function SavedTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { userId, entitlements } = await readBilling();
  if (userId === null) redirect(signInHref("/trips"));

  const page = parsePage((await searchParams).page);
  const offset = (page - 1) * PAGE_SIZE;
  let trips: Awaited<ReturnType<typeof listSavedTrips>> = [];
  let hasMore = false;
  let failed = false;
  try {
    const rows = await listSavedTrips(userId, PAGE_SIZE + 1, offset);
    hasMore = rows.length > PAGE_SIZE;
    trips = rows.slice(0, PAGE_SIZE);
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
          Each saved trip is a snapshot of the plan you kept: the route, the concierge
          day plan, and the safety envelope as it was captured. Menu and room-rate checks
          are not stored, so open a trip to refresh them.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LinkButton href="/" variant="secondary">
            Plan another trip
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
            <h2 className="t-title">
              {page > 1 ? "No saved trips on this page." : "No saved trips yet."}
            </h2>
            <p className="t-small measure mt-2 text-muted">
              {page > 1
                ? "Go back to a newer page to find your saved plans."
                : "When a plan is ready, choose Save trip in the command bar. It will appear here."}
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

        {failed ? null : page > 1 || hasMore ? (
          <nav
            aria-label="Saved trip pages"
            className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-4"
          >
            <p className="t-data-sm text-muted">Page {page}</p>
            <div className="flex flex-wrap items-center gap-2">
              {page > 1 ? (
                <LinkButton href={pageHref(page - 1)} variant="secondary">
                  Newer
                </LinkButton>
              ) : null}
              {hasMore ? (
                <LinkButton href={pageHref(page + 1)} variant="secondary">
                  Older
                </LinkButton>
              ) : null}
            </div>
          </nav>
        ) : null}

        <div className="mt-12">
          <DestinationAd
            variant="inline"
            intent="plan"
            placement="trips"
            destination={trips[0]?.destination}
            signedIn
          />
        </div>
      </main>
      <SiteFooter adDestination={trips[0]?.destination} />
    </div>
  );
}
