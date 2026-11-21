"use client";

import { LinkButton } from "@/components/ui";
import {
  LEG_MODE_LABELS,
  type RouteDay,
  type RouteLeg,
  type TripRoute,
} from "@/lib/route/routeTypes";
import { TRANSPORT_LABELS } from "@/lib/types";
import type { PlaceCategory } from "@/lib/agent/agentTypes";

const CATEGORY_LABEL: Readonly<Record<PlaceCategory, string>> = {
  stay: "Stay",
  eat: "Table",
  hike: "Hike",
  visit: "Visit",
  care: "Care",
};

function distance(value: number): string {
  return `${value.toFixed(1)} km`;
}

function minutes(value: number): string {
  if (value <= 0) return "0 min";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function endpoints(day: RouteDay, leg: RouteLeg): string {
  const name = (id: string): string => {
    if (id === "base") return day.base?.name ?? "Base";
    return day.stops.find((stop) => stop.placeId === id)?.name ?? "Stop";
  };
  return `${name(leg.from)} to ${name(leg.to)}`;
}

function DayRoute({ day }: { day: RouteDay }) {
  const stopWord = day.stops.length === 1 ? "stop" : "stops";
  return (
    <article className="border-t border-hairline py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="t-heading text-ink">
          <span className="t-data mr-3 text-muted">{String(day.day).padStart(2, "0")}</span>
          {day.title}
        </h4>
        <p className="t-data-sm text-muted">
          {day.stops.length} {stopWord} · {distance(day.totals.distanceKm)} ·{" "}
          {minutes(day.totals.durationMin)} travel
        </p>
      </div>
      {day.base !== null ? (
        <p className="t-data-sm mt-1 text-muted">Base: {day.base.name}</p>
      ) : null}
      <p className="t-data-sm mt-1 text-muted">
        Route walking {day.totals.walkKm.toFixed(1)} km · day ceiling{" "}
        {day.walkingCapKm.toFixed(1)} km · on site {minutes(day.totals.onSiteMin)}
      </p>
      {day.demanding ? (
        <p className="t-small mt-2 text-ink">
          Demanding day · keep the recovery window and start slowly.
        </p>
      ) : null}

      {day.stops.length > 0 ? (
        <ol aria-label={`Day ${day.day} stop order`} className="mt-4 list-none p-0">
          {day.stops.map((stop, index) => (
            <li
              key={stop.placeId}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hairline py-2"
            >
              <span className="t-data-sm w-5 shrink-0 text-muted">{index + 1}</span>
              <span className="t-small min-w-0 text-ink">{stop.name}</span>
              <span className="t-data-sm shrink-0 text-muted">
                {CATEGORY_LABEL[stop.category]} · {minutes(stop.serviceMin)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="t-small mt-3 text-muted">
          No verified coordinates for this day, so there is no stop order.
        </p>
      )}

      {day.legs.length > 0 ? (
        <details className="mt-4">
          <summary className="t-small min-h-11 cursor-pointer text-muted">
            Legs · {day.legs.length}
          </summary>
          <ul aria-label={`Day ${day.day} legs`} className="mt-1 list-none p-0">
            {day.legs.map((leg, index) => (
              <li
                key={`${index}-${leg.from}-${leg.to}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline py-2"
              >
                <span className="t-small min-w-0 text-ink">{endpoints(day, leg)}</span>
                <span className="t-data-sm shrink-0 text-muted">
                  {LEG_MODE_LABELS[leg.mode]} · {distance(leg.distanceKm)} ·{" "}
                  {minutes(leg.durationMin)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {day.warnings.map((warning) => (
        <p key={`${warning.code}-${warning.message}`} className="t-small mt-2 text-caution">
          {warning.message}
        </p>
      ))}

      <div className="mt-4">
        {day.mapUrl !== null ? (
          <LinkButton href={day.mapUrl} variant="secondary">
            Open day {day.day} in Google Maps
          </LinkButton>
        ) : (
          <p className="t-small text-muted">
            {day.restDay
              ? "This is a rest day, so there is no route to map."
              : "No map link for this day. The coordinates were not verified."}
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * Transport-aware route for the finished plan: modeled totals, the optimized stop order per
 * day, every leg with its chosen mode, and one Google Maps handoff per day. All numbers are
 * modeled estimates; the day plan above remains the agent's own narrative.
 */
export function RoutePanel({ route }: { route: TripRoute }) {
  const pacing = route.warnings.filter((warning) => warning.code === "pacing_adjacent");
  const arrivalBase = route.days.find((day) => day.base !== null)?.base ?? null;
  const routable = route.days.some((day) => day.stops.length > 0);

  return (
    <section className="mt-12" aria-labelledby="travel-route-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="travel-route-heading" className="t-title text-ink">
          Travel route
        </h3>
        <p className="t-data text-muted">{TRANSPORT_LABELS[route.transport]}</p>
      </div>
      <p className="t-small measure mt-2 text-muted">
        Stops are ordered from your base to shorten each day. Travel times are modeled from
        assumed speeds, not live schedules or traffic.
      </p>

      {routable ? (
        <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <dt className="t-label text-muted">Distance</dt>
            <dd className="t-data mt-1 text-ink">{distance(route.totals.distanceKm)}</dd>
          </div>
          <div>
            <dt className="t-label text-muted">Travel time</dt>
            <dd className="t-data mt-1 text-ink">{minutes(route.totals.durationMin)}</dd>
          </div>
          <div>
            <dt className="t-label text-muted">On foot</dt>
            <dd className="t-data mt-1 text-ink">{distance(route.totals.walkKm)}</dd>
          </div>
          <div>
            <dt className="t-label text-muted">On site</dt>
            <dd className="t-data mt-1 text-ink">{minutes(route.totals.onSiteMin)}</dd>
          </div>
        </dl>
      ) : (
        <p className="t-small measure mt-4 text-muted">
          No stop had verified coordinates, so no route could be built. The day plan below
          still lists every selected place.
        </p>
      )}

      {pacing.length > 0 ? (
        <div className="mt-6 border-t border-hairline pt-3">
          {pacing.map((warning) => (
            <p key={warning.message} className="t-small text-caution">
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}

      {route.mapUrl !== null ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4">
          <p className="t-data-sm text-muted">
            Arrival · {route.origin || "Your starting point"} to{" "}
            {arrivalBase?.name ?? "your base"}
          </p>
          <LinkButton href={route.mapUrl} variant="secondary">
            Open the arrival route
          </LinkButton>
        </div>
      ) : null}

      {routable ? (
        <div className="mt-4">
          {route.days.map((day) => (
            <DayRoute key={day.day} day={day} />
          ))}
        </div>
      ) : null}

      <p className="t-small mt-4 text-muted">
        The map links open Google Maps in a new tab and send these stops to Google.
      </p>
    </section>
  );
}
