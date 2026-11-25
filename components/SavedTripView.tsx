"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentPlanView } from "@/components/AgentPlanView";
import { DeleteSavedTripButton } from "@/components/DeleteSavedTripButton";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CareCardButton, ItineraryBoard } from "@/components/ItineraryBoard";
import { UpgradeCallout } from "@/components/UpgradeCallout";
import { Button, Callout, LinkButton } from "@/components/ui";
import { VenueMissionControl } from "@/components/venue/VenueMissionControl";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useVenueResearch } from "@/hooks/useVenueResearch";
import { rememberAdDestination } from "@/lib/ads/destinationMemory";
import type { BillingEntitlements } from "@/lib/billing/plans";
import { describeTrip } from "@/lib/describeTrip";
import { buildHealthTripPlan } from "@/lib/healthTripEngine";
import type { SavedTrip } from "@/lib/savedTrips";
import { CONDITION_LABELS } from "@/lib/types";

function savedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date not recorded";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function venueStatusLine(
  requested: boolean,
  state: ReturnType<typeof useVenueResearch>["state"],
): string {
  if (!requested) return "Not checked on this page yet";
  const total = state.order.length;
  const checked = state.order.filter((id) => {
    const worker = state.workers[id];
    return (
      worker !== undefined &&
      (worker.phase === "complete" || worker.phase === "error")
    );
  }).length;
  if (state.status === "running") {
    return total > 0
      ? `Checking ${checked} of ${total} ${total === 1 ? "page" : "pages"}`
      : "Checking current pages";
  }
  if (state.status === "complete") {
    return `${checked} of ${total} ${total === 1 ? "page" : "pages"} checked`;
  }
  if (state.status === "error") return "Needs a retry";
  return "Ready to check";
}

/**
 * Read-only saved snapshot. The engine plan is rebuilt deterministically from the saved
 * trip, so the pacing envelope is always current with the documented engine, while the
 * concierge plan and its caps remain exactly as captured. Menu and room-rate checks are
 * explicit: the saved page never opens live pages until the reader asks.
 */
export function SavedTripView({
  saved,
  entitlements,
}: {
  saved: SavedTrip;
  entitlements: BillingEntitlements;
}) {
  const reduced = useReducedMotion();
  const enginePlan = useMemo(
    () =>
      buildHealthTripPlan({
        destination: saved.trip.destination,
        days: saved.trip.days,
        condition: saved.trip.condition,
      }),
    [saved.trip],
  );
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [venueRequested, setVenueRequested] = useState(false);
  const venue = useVenueResearch({
    plan: saved.plan,
    destination: saved.trip.destination,
    checkIn: saved.trip.checkIn ?? "",
    days: saved.trip.days,
    travelers: saved.trip.travelers ?? 1,
    enabled: entitlements.venueResearch && venueRequested,
  });

  // Keep the site-wide house ad on the same destination the reader came back to.
  useEffect(() => {
    rememberAdDestination(saved.trip.destination);
  }, [saved.trip.destination]);

  const scrollToChecks = (): void => {
    window.setTimeout(() => {
      document.getElementById("venue-deck-heading")?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    }, 60);
  };

  const openChecks = (): void => {
    setVenueRequested(true);
    scrollToChecks();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-container flex-1 pb-16 pt-12 md:pb-24 md:pt-20">
        <p className="t-label text-muted">Saved trip</p>
        <h1 className="t-display measure mt-3 [overflow-wrap:anywhere]">
          {saved.trip.destination}
        </h1>
        <p className="t-body measure mt-5 text-muted">
          {describeTrip({
            destination: saved.trip.destination,
            days: saved.trip.days,
            condition: saved.trip.condition,
          })}
        </p>
        <p className="t-data-sm mt-3 text-muted">
          Saved {savedDate(saved.savedAt)} · {CONDITION_LABELS[saved.trip.condition]} ·{" "}
          {saved.plan.days.length} days
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LinkButton href="/" variant="primary">
            Plan another trip
          </LinkButton>
          <LinkButton href="/trips" variant="secondary">
            All saved trips
          </LinkButton>
          <DeleteSavedTripButton id={saved.id} />
        </div>

        <div className="mt-6">
          <Callout tone="info" title="Saved snapshot">
            <p>
              This page shows the plan as it was saved. The safety envelope is rebuilt
              from the same trip with the current pacing engine; the concierge route,
              places, and sources are unchanged.
            </p>
            <p className="mt-2">
              Menus, room rates, and page checks are not stored. Use Refresh menus and
              rates under Checked places for current facts.
            </p>
          </Callout>
        </div>

        <section aria-labelledby="saved-plan-heading" className="mt-12">
          <div className="panel-head">
            <h2 id="saved-plan-heading" className="t-label text-muted">
              Saved route
            </h2>
            <p className="t-data-sm text-muted">Concierge snapshot</p>
          </div>
          <div className="mt-4">
            <AgentPlanView
              plan={saved.plan}
              origin={saved.trip.origin}
              transport={saved.trip.transport}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
              venue={venue.evidence}
              onViewChecks={openChecks}
            />
          </div>
        </section>

        <section aria-labelledby="saved-checks-heading" className="mt-16">
          <div className="panel-head">
            <h2 id="saved-checks-heading" className="t-label text-muted">
              Checked places
            </h2>
            <p className="t-data-sm text-muted">
              {venueStatusLine(venueRequested, venue.state)}
            </p>
          </div>
          {entitlements.venueResearch ? (
            venueRequested ? (
              <div className="mt-4">
                <VenueMissionControl
                  state={venue.state}
                  checkIn={saved.trip.checkIn ?? ""}
                  onRetry={venue.retry}
                />
              </div>
            ) : (
              <div className="mt-4 border-t border-solid border-hairline-strong pt-4">
                <p className="t-body measure text-muted">
                  Menus and room rates are checked snapshots, not part of the saved plan.
                  Refresh them to open the selected menu and booking pages again.
                </p>
                <div className="mt-4">
                  <Button variant="secondary" onClick={openChecks}>
                    Refresh menus and rates
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="mt-4">
              <UpgradeCallout feature="Live menus and room rates" />
            </div>
          )}
        </section>

        <section aria-labelledby="saved-safety-heading" className="mt-16">
          <div className="panel-head">
            <h2 id="saved-safety-heading" className="t-label text-muted">
              Pacing and safety
            </h2>
            <CareCardButton
              destination={saved.trip.destination}
              condition={saved.trip.condition}
              plan={enginePlan}
            />
          </div>
          <div className="mt-6">
            <ItineraryBoard
              plan={enginePlan}
              destination={saved.trip.destination}
              condition={saved.trip.condition}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
            />
          </div>
        </section>

        <p className="t-small measure mt-12 border-t border-hairline pt-4 text-muted">
          Planning aid only. Not medical advice. Confirm hours, access, and safety details
          before booking.
        </p>
      </main>
      <SiteFooter adDestination={saved.trip.destination} />
    </div>
  );
}
