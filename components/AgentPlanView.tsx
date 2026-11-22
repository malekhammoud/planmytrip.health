"use client";

import { useMemo } from "react";
import { AgentPicks } from "@/components/AgentPicks";
import { AgentPlanDays } from "@/components/AgentPlanDays";
import { DayFocus } from "@/components/DayFocus";
import { RoutePanel } from "@/components/RoutePanel";
import { TripMap } from "@/components/TripMap";
import { TripOutcomePanel } from "@/components/TripOutcomePanel";
import { Callout, LinkButton } from "@/components/ui";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BUDGET_LABELS, type AgentTripPlan } from "@/lib/agent/agentTypes";
import type { TripCaptureContext } from "@/lib/data/types";
import type { VenueEvidence } from "@/lib/venue/types";
import { buildTripRoute } from "@/lib/route/routePlan";
import type { TransportMode } from "@/lib/types";

/** Props for {@link AgentPlanView}. */
export interface AgentPlanViewProps {
  plan: AgentTripPlan;
  visible?: boolean;
  capture?: TripCaptureContext;
  /** Free-text starting point for the arrival link. */
  origin?: string;
  /** Travel method used to order stops and choose leg modes. */
  transport?: TransportMode;
  /** The focused day, shared with the map, route, day plan, and envelope. */
  activeDay?: number | null;
  onSelectDay?: (day: number | null) => void;
  /** Checked menu and room-rate facts for the selected places. */
  venue?: readonly VenueEvidence[];
}

function money(plan: AgentTripPlan): string {
  if (plan.budget.estimatedTotal === null) return "Estimate not available";
  const value = Math.round(plan.budget.estimatedTotal)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${plan.budget.currency} ${value}`;
}

function generated(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "Time not available";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * The finished concierge plan as the central stage: day focus chips, the map, the
 * derived route, the expandable day plan, picks, notes, and sources. Selecting a day
 * highlights it on the map and opens it in the route and day plan; the route stays a
 * pure projection and never writes back to the plan.
 */
export function AgentPlanView({
  plan,
  visible = true,
  capture,
  origin = "",
  transport = "mixed",
  activeDay = null,
  onSelectDay,
  venue = [],
}: AgentPlanViewProps) {
  const reduced = useReducedMotion();
  const outside = plan.days.filter((day) => !day.withinCaps);
  const route = useMemo(
    () =>
      buildTripRoute({
        days: plan.days,
        places: plan.places,
        transport,
        origin,
      }),
    [plan, transport, origin],
  );
  const select = (day: number | null): void => onSelectDay?.(day);
  const showOnMap = (day: number): void => {
    select(day);
    document
      .getElementById("trip-map")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  };

  return (
    <div>
      {plan.degraded ? (
        <div className="mb-4">
          <Callout tone="caution" title="Verified picks, conservative route">
            The research finished but the concierge could not synthesise every day. This
            route uses the verified picks with recovery built in.
          </Callout>
        </div>
      ) : null}

      <p className="t-body measure text-ink">{plan.summary}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {plan.baseArea ? (
          <p className="t-data-sm text-muted">Base: {plan.baseArea}</p>
        ) : null}
        {plan.routeTheme ? (
          <p className="t-data-sm text-muted">Route: {plan.routeTheme}</p>
        ) : null}
        <p className="t-data-sm text-muted">
          {BUDGET_LABELS[plan.budget.level]} · {money(plan)}
        </p>
        <p className="t-data-sm text-muted">Generated {generated(plan.generatedAt)}</p>
        {venue.length > 0 ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="t-data-sm text-muted">
              Live venue checks: {venue.filter((item) => item.kind === "menu").length} menus ·{" "}
              {venue.filter((item) => item.kind === "hotel").length} room quotes
            </span>
            <LinkButton
              variant="ghost"
              size="sm"
              href="#venue-deck-heading"
              external={false}
            >
              View checks
            </LinkButton>
          </span>
        ) : null}
      </div>

      {outside.length > 0 ? (
        <div className="mt-4">
          <Callout tone="caution" title="A day is above its modeled ceiling">
            Follow the Pacing limits in the safety envelope. The concierge estimate is
            not a target.
          </Callout>
        </div>
      ) : null}

      <div className="mt-5">
        <DayFocus days={plan.days} activeDay={activeDay} onSelectDay={select} />
      </div>

      <div className="mt-4">
        <TripMap
          places={plan.places}
          days={plan.days}
          route={route}
          visible={visible}
          activeDay={activeDay}
        />
      </div>

      <RoutePanel
        route={route}
        activeDay={activeDay}
        onSelectDay={select}
        onShowOnMap={showOnMap}
      />

      <section className="mt-10" aria-labelledby="concierge-days">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-solid border-hairline-strong pt-3">
          <h3 id="concierge-days" className="t-label text-muted">
            Day plan
          </h3>
          <p className="t-data-sm text-muted">
            {activeDay === null
              ? `${plan.days.length} days · open a day for its blocks`
              : `Day ${String(activeDay).padStart(2, "0")} · ${plan.days.length} days · blocks and checkpoint`}
          </p>
        </div>
        <AgentPlanDays
          days={plan.days}
          activeDay={activeDay}
          onSelectDay={select}
          onShowOnMap={showOnMap}
        />
      </section>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <details className="border-t border-solid border-hairline-strong pt-3">
          <summary className="t-label flex min-h-11 cursor-pointer items-center justify-between gap-3 text-muted">
            <span>Selected places · {plan.places.length}</span>
            <span className="t-data-sm">Open list</span>
          </summary>
          <AgentPicks places={plan.places} evidence={venue} />
        </details>

        <div className="flex flex-col gap-10">
          <section aria-labelledby="concierge-safety">
            <h3 id="concierge-safety" className="t-label border-t border-solid border-hairline-strong pt-3 text-muted">
              Safety notes
            </h3>
            {plan.safetyNotes.length > 0 ? (
              <ul className="mt-2 list-none p-0">
                {plan.safetyNotes.map((note) => (
                  <li key={note} className="border-t border-hairline py-2 t-small text-muted">
                    {note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-small mt-2 text-muted">No extra safety notes were returned.</p>
            )}
          </section>

          <details className="border-t border-solid border-hairline-strong pt-3">
            <summary className="t-label flex min-h-11 cursor-pointer items-center justify-between gap-3 text-muted">
              <span>Before you book · {plan.bookingChecklist.length}</span>
              <span className="t-data-sm">Open list</span>
            </summary>
            {plan.bookingChecklist.length > 0 ? (
              <ul className="mt-2 list-none p-0">
                {plan.bookingChecklist.map((item) => (
                  <li key={item} className="border-t border-hairline py-2 t-small text-muted">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-small mt-2 text-muted">
                Confirm hours, accessibility, and cancellation terms directly with each
                venue.
              </p>
            )}
            <p className="t-small mt-2 text-muted">{plan.budget.notes}</p>
          </details>
        </div>
      </div>

      {plan.sources.length > 0 ? (
        <details className="mt-10 border-t border-solid border-hairline-strong pt-3">
          <summary className="t-label flex min-h-11 cursor-pointer items-center justify-between gap-3 text-muted">
            <span>Sources · {plan.sources.length}</span>
            <span className="t-data-sm">Open list</span>
          </summary>
          <ul className="mt-2 list-none p-0">
            {plan.sources.map((source) => (
              <li key={source.url} className="border-t border-hairline py-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center t-small text-accent [overflow-wrap:anywhere] hover:underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {capture !== undefined && capture.consent ? (
        <div className="mt-10">
          <TripOutcomePanel capture={capture} />
        </div>
      ) : null}
    </div>
  );
}
