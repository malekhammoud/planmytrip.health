/**
 * Plans a whole trip's route from a finished concierge plan.
 *
 * Inputs: the plan's days and places, the traveler's transport mode, and an origin label.
 * Outputs: one RouteDay per trip day, trip totals, pacing cautions, and the arrival link.
 * Invariants: a place without verified coordinates is dropped, never guessed; the agent's step
 * estimate is never read; the engine's walking ceiling is copied, never widened; adjacent
 * demanding days are reported, never silently accepted.
 */

import type { PlannerDay, PlannerPlace } from "../agent/agentTypes";
import type { TransportMode } from "../types";
import { roundKm } from "./geometry";
import { buildArrivalMapUrl, mapsTravelModeFor } from "./mapsLink";
import { buildRouteDay } from "./routeDay";
import { isMapped } from "./routeStops";
import type { RouteWarning, TripRoute } from "./routeTypes";

/** Inputs for {@link buildTripRoute}. */
export interface RoutePlanInput {
  days: readonly PlannerDay[];
  places: readonly PlannerPlace[];
  transport: TransportMode;
  /** Free-text starting point, such as a home city or airport. May be empty. */
  origin: string;
}

/** Builds the whole trip's route from a finished plan. */
export function buildTripRoute(input: RoutePlanInput): TripRoute {
  const mapped = input.places.filter(isMapped);
  const byId = new Map(mapped.map((place) => [place.id, place]));
  const stays = mapped.filter((place) => place.category === "stay");
  const fallback = stays[0] ?? null;

  const days = input.days.map((day) =>
    buildRouteDay(day, byId, input.places, stays, fallback, input.transport),
  );

  const warnings: RouteWarning[] = [];
  let distanceKm = 0;
  let durationMin = 0;
  let walkKm = 0;
  let walkMinutes = 0;
  let onSiteMin = 0;
  for (const day of days) {
    distanceKm += day.totals.distanceKm;
    durationMin += day.totals.durationMin;
    walkKm += day.totals.walkKm;
    walkMinutes += day.totals.walkMinutes;
    onSiteMin += day.totals.onSiteMin;
    warnings.push(...day.warnings);
  }
  for (let index = 0; index + 1 < days.length; index += 1) {
    const current = days[index];
    const next = days[index + 1];
    if (current.demanding && next.demanding) {
      warnings.push({
        code: "pacing_adjacent",
        day: next.day,
        message: `Day ${next.day} follows a demanding day. Keep the recovery window and start slowly.`,
      });
    }
  }

  const base = fallback;
  const mapUrl =
    base === null
      ? null
      : buildArrivalMapUrl({
          origin: input.origin,
          // Coordinates, not the venue name: Google resolves a coordinate pair exactly,
          // while a hotel name can collide with a same-named place in another city.
          destination: `${base.lat},${base.lng}`,
          travelMode: mapsTravelModeFor(input.transport),
        });

  return {
    transport: input.transport,
    origin: input.origin.trim(),
    days,
    totals: {
      distanceKm: roundKm(distanceKm),
      durationMin,
      walkKm: roundKm(walkKm),
      walkMinutes,
      onSiteMin,
    },
    mapUrl,
    warnings,
  };
}

/** Re-exported so callers and tests keep one public route entry point. */
export { DEMANDING_WALK_RATIO } from "./routeDay";
