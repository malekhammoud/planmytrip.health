"use client";

import { useMemo, useState } from "react";
import { AgentPlanView } from "@/components/AgentPlanView";
import { DeleteSavedTripButton } from "@/components/DeleteSavedTripButton";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CareCardButton, ItineraryBoard } from "@/components/ItineraryBoard";
import { Callout, LinkButton, type CalloutTone } from "@/components/ui";
import { describeTrip } from "@/lib/describeTrip";
import {
  buildHealthTripPlan,
  type SunLifeSeverity,
} from "@/lib/healthTripEngine";
import type { SavedTrip } from "@/lib/savedTrips";
import { CONDITION_LABELS } from "@/lib/types";

const ALERT_TONES: Record<SunLifeSeverity, CalloutTone> = {
  ok: "info",
  caution: "caution",
  blocking: "risk",
};

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
export function SavedTripView({ saved }: { saved: SavedTrip }) {
  const enginePlan = useMemo(
    () =>
      buildHealthTripPlan({
        destination: saved.trip.destination,
        days: saved.trip.days,
        condition: saved.trip.condition,
        medication: saved.trip.medication,
        hasSunLifeTravelCoverage: saved.trip.hasSunLifeTravelCoverage,
      }),
    [saved.trip],
  );
  const [activeDay, setActiveDay] = useState<number | null>(
    saved.plan.days[0]?.day ?? null,
  );

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
            />
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
              medication={saved.trip.medication}
              plan={enginePlan}
            />
          </div>
          <div className="mt-4">
            <Callout
              tone={ALERT_TONES[enginePlan.sunLifeAlert.severity]}
              title={enginePlan.sunLifeAlert.title}
            >
              <div className="flex flex-col gap-1">
                {enginePlan.sunLifeAlert.messages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            </Callout>
          </div>
          <div className="mt-6">
            <ItineraryBoard
              plan={enginePlan}
              destination={saved.trip.destination}
              condition={saved.trip.condition}
              medication={saved.trip.medication}
              activeDay={activeDay}
            />
          </div>
        </section>

        <p className="t-small measure mt-12 border-t border-hairline pt-4 text-muted">
          This is a saved plan snapshot. Live verification and source freshness are not
          rechecked here. Confirm hours, access, and safety details before booking.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
