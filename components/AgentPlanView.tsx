"use client";

import { AgentPicks } from "@/components/AgentPicks";
import { AgentPlanDays } from "@/components/AgentPlanDays";
import { TripMap } from "@/components/TripMap";
import { TripOutcomePanel } from "@/components/TripOutcomePanel";
import { Callout } from "@/components/ui";
import { BUDGET_LABELS, type AgentTripPlan } from "@/lib/agent/agentTypes";
import type { TripCaptureContext } from "@/lib/data/types";

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

/** Finished concierge plan: summary, map, day plan, picks, safety, and sources. */
export function AgentPlanView({
  plan,
  visible = true,
  capture,
}: {
  plan: AgentTripPlan;
  visible?: boolean;
  capture?: TripCaptureContext;
}) {
  const outside = plan.days.filter((day) => !day.withinCaps);
  return (
    <div>
      {plan.degraded ? (
        <div className="mb-6">
          <Callout tone="caution" title="Verified picks, conservative route">
            The research finished but the concierge could not synthesise every day. This
            route uses the verified picks with recovery built in.
          </Callout>
        </div>
      ) : null}

      <p className="t-body measure text-ink">{plan.summary}</p>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {plan.baseArea ? (
          <p className="t-data text-muted">Base: {plan.baseArea}</p>
        ) : null}
        {plan.routeTheme ? (
          <p className="t-data text-muted">Route: {plan.routeTheme}</p>
        ) : null}
        <p className="t-data text-muted">
          {BUDGET_LABELS[plan.budget.level]} · {money(plan)}
        </p>
        <p className="t-data-sm text-muted">Generated {generated(plan.generatedAt)}</p>
      </div>

      {outside.length > 0 ? (
        <div className="mt-6">
          <Callout tone="caution" title="A day is above its modeled ceiling">
            Follow the Pacing limits below. The concierge estimate is not a target.
          </Callout>
        </div>
      ) : null}

      <div className="mt-8">
        <TripMap places={plan.places} days={plan.days} visible={visible} />
      </div>

      <section className="mt-12" aria-labelledby="concierge-days">
        <h3 id="concierge-days" className="t-title text-ink">
          Day plan
        </h3>
        <div className="mt-4">
          <AgentPlanDays days={plan.days} />
        </div>
      </section>

      <section className="mt-12" aria-labelledby="concierge-picks">
        <h3 id="concierge-picks" className="t-title text-ink">
          Selected places
        </h3>
        <AgentPicks places={plan.places} />
      </section>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="concierge-safety">
          <h3 id="concierge-safety" className="t-title text-ink">
            Safety notes
          </h3>
          {plan.safetyNotes.length > 0 ? (
            <ul className="mt-3 list-none p-0">
              {plan.safetyNotes.map((note) => (
                <li key={note} className="border-t border-hairline py-3 t-small text-muted">
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-small mt-3 text-muted">No extra safety notes were returned.</p>
          )}
        </section>

        <section aria-labelledby="concierge-booking">
          <h3 id="concierge-booking" className="t-title text-ink">
            Before you book
          </h3>
          {plan.bookingChecklist.length > 0 ? (
            <ul className="mt-3 list-none p-0">
              {plan.bookingChecklist.map((item) => (
                <li key={item} className="border-t border-hairline py-3 t-small text-muted">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-small mt-3 text-muted">
              Confirm hours, accessibility, and cancellation terms directly with each
              venue.
            </p>
          )}
          <p className="t-small mt-3 text-muted">{plan.budget.notes}</p>
        </section>
      </div>

      {plan.sources.length > 0 ? (
        <section className="mt-12" aria-labelledby="concierge-sources">
          <h3 id="concierge-sources" className="t-title text-ink">
            Sources
          </h3>
          <ul className="mt-3 list-none p-0">
            {plan.sources.map((source) => (
              <li key={source.url} className="border-t border-hairline py-3">
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
        </section>
      ) : null}
      {capture !== undefined ? <TripOutcomePanel capture={capture} /> : null}
    </div>
  );
}
