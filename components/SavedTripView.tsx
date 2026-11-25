"use client";

import { useMemo, useState } from "react";
import { AgentPlanView } from "@/components/AgentPlanView";
import { DeleteSavedTripButton } from "@/components/DeleteSavedTripButton";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CareCardButton, ItineraryBoard } from "@/components/ItineraryBoard";
import { UpgradeCallout } from "@/components/UpgradeCallout";
import { LinkButton } from "@/components/ui";
import { VenueMissionControl } from "@/components/venue/VenueMissionControl";
import { useVenueResearch } from "@/hooks/useVenueResearch";
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

/**
 * Read-only saved snapshot. The engine plan is rebuilt deterministically from the saved
 * trip, so the pacing envelope is always current with the documented engine, while the
 * concierge plan and its caps remain exactly as captured.
 */
export function SavedTripView({
  saved,
  entitlements,
}: {
  saved: SavedTrip;
  entitlements: BillingEntitlements;
}) {
  const enginePlan = useMemo(
    () =>
      buildHealthTripPlan({
        destination: saved.trip.destination,
        days: saved.trip.days,
        condition: saved.trip.condition,
      }),
    [saved.trip],
  );
  const [activeDay, setActiveDay] = useState<number | null>(
    saved.plan.days[0]?.day ?? null,
  );
  const venue = useVenueResearch({
    plan: saved.plan,
    destination: saved.trip.destination,
    checkIn: saved.trip.checkIn ?? "",
    days: saved.trip.days,
    travelers: saved.trip.travelers ?? 1,
    enabled: entitlements.venueResearch,
  });

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
          <LinkButton href="/trips" variant="secondary">
            All saved trips
          </LinkButton>
          <DeleteSavedTripButton id={saved.id} />
        </div>

        <section aria-labelledby="saved-plan-heading" className="mt-12">
          <div className="panel-head">
            <h2 id="saved-plan-heading" className="t-label text-muted">
              Concierge plan
            </h2>
            <p className="t-data-sm text-muted">Saved snapshot</p>
          </div>
          <div className="mt-4">
            <AgentPlanView
              plan={saved.plan}
              origin={saved.trip.origin}
              transport={saved.trip.transport}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
              venue={venue.evidence}
            />
            {entitlements.venueResearch ? (
              <VenueMissionControl
                state={venue.state}
                checkIn={saved.trip.checkIn ?? ""}
                onRetry={venue.retry}
              />
            ) : (
              <div className="mt-10">
                <UpgradeCallout feature="Live menus and room rates" />
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="saved-safety-heading" className="mt-16">
          <div className="panel-head">
            <h2 id="saved-safety-heading" className="t-label text-muted">
              Safety envelope
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
            />
          </div>
        </section>

        <p className="t-small measure mt-12 border-t border-hairline pt-4 text-muted">
          This is a saved plan snapshot. Venue menus and rates may be refreshed separately;
          the saved plan itself is unchanged. Confirm hours, access, and safety details
          before booking.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
