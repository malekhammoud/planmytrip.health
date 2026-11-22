"use client";

import { Button, LinkButton } from "@/components/ui";
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

/** One day's route row; the open day is the workspace's focused day. */
function DayRoute({
  day,
  open,
  onToggle,
  onShowOnMap,
}: {
  day: RouteDay;
  open: boolean;
  onToggle: () => void;
  onShowOnMap: () => void;
}) {
  const stopWord = day.stops.length === 1 ? "stop" : "stops";
  const detailId = `route-day-${day.day}`;
  return (
    <article
      className={`py-4 ${open ? "border-t-2 border-t-accent" : "border-t border-hairline"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h4 className="t-heading min-w-0 text-ink">
          <span className="t-data mr-3 text-muted">{String(day.day).padStart(2, "0")}</span>
          {day.title}
        </h4>
        <div className="flex shrink-0 items-center gap-3">
          <p className="t-data-sm hidden text-muted sm:block">
            {day.stops.length} {stopWord} · {distance(day.totals.distanceKm)} ·{" "}
            {minutes(day.totals.durationMin)}
          </p>
          <Button variant="ghost" size="sm" onClick={onShowOnMap}>
            Map
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={onToggle}
          >
            {open ? "Close" : "Open"}
          </Button>
        </div>
      </div>
      <p className="t-data-sm mt-1 text-muted sm:hidden">
        {day.stops.length} {stopWord} · {distance(day.totals.distanceKm)} ·{" "}
        {minutes(day.totals.durationMin)} travel
      </p>

      <div id={detailId} hidden={!open} className="anim-fade">
        {day.base !== null ? (
          <p className="t-data-sm mt-2 text-muted">Base: {day.base.name}</p>
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
          <ol aria-label={`Day ${day.day} stop order`} className="mt-3 list-none p-0">
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
          <details className="mt-3">
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

        <div className="mt-3">
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
      </div>
    </article>
  );
}

/** Props for {@link RoutePanel}. */
export interface RoutePanelProps {
  route: TripRoute;
  /** The focused day; its row is open and ruled in accent. */
  activeDay?: number | null;
  onSelectDay?: (day: number | null) => void;
  /** Selects a day and brings the map into view. */
  onShowOnMap?: (day: number) => void;
}

/**
 * Transport-aware route for the finished plan: modeled totals, one expandable row per
 * day, and the Google Maps handoff. The open row follows the workspace's focused day,
 * so the map, route, and day plan stay in sync. All numbers are modeled estimates.
 */
export function RoutePanel({
  route,
  activeDay = null,
  onSelectDay,
  onShowOnMap,
}: RoutePanelProps) {
  const pacing = route.warnings.filter((warning) => warning.code === "pacing_adjacent");
  const arrivalBase = route.days.find((day) => day.base !== null)?.base ?? null;
  const routable = route.days.some((day) => day.stops.length > 0);

  return (
    <section className="mt-8" aria-labelledby="travel-route-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-solid border-hairline-strong pt-3">
        <h3 id="travel-route-heading" className="t-label text-muted">
          Travel route
        </h3>
        <p className="t-data-sm text-muted">
          {activeDay === null
            ? TRANSPORT_LABELS[route.transport]
            : `Day ${String(activeDay).padStart(2, "0")} · ${TRANSPORT_LABELS[route.transport]}`}
        </p>
      </div>
      <p className="t-small measure mt-1 text-muted">
        Stops are ordered from your base. Times are modeled from assumed speeds, not
        live schedules; the Maps link shows real times.
      </p>

      {routable ? (
        <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
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
        <p className="t-small measure mt-3 text-muted">
          No stop had verified coordinates, so no route could be built. The day plan
          still lists every selected place.
        </p>
      )}

      {pacing.length > 0 ? (
        <div className="mt-4 border-t border-hairline pt-2">
          {pacing.map((warning) => (
            <p key={warning.message} className="t-small text-caution">
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}

      {route.mapUrl !== null ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-3">
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
        <div className="mt-2">
          {(activeDay === null
            ? route.days
            : route.days.filter((day) => day.day === activeDay)
          ).map((day) => (
            <DayRoute
              key={day.day}
              day={day}
              open={activeDay === day.day}
              onToggle={() => onSelectDay?.(activeDay === day.day ? null : day.day)}
              onShowOnMap={() => onShowOnMap?.(day.day)}
            />
          ))}
        </div>
      ) : null}

      <p className="t-small mt-3 text-muted">
        The map links open Google Maps in a new tab and send these stops to Google.
      </p>
    </section>
  );
}
