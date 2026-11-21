/**
 * Builds one route day: stop order, legs, totals, pacing flag, cautions, and its Maps link.
 *
 * Inputs: one concierge day, the plan's places, its base, and the traveler's transport.
 * Outputs: a complete RouteDay.
 * Invariants: legs run base to stop to stop; route walking is counted only for walking legs;
 * the day ceiling is copied from the engine, never recomputed; a caution names the day.
 */

import type { PlannerDay, PlannerPlace } from "../agent/agentTypes";
import type { TransportMode } from "../types";
import { computePlannerDose } from "../data/dose";
import { haversineKm, roundKm } from "./geometry";
import { isLongWalk, planLeg, WALK_CAUTION_KM } from "./legs";
import {
  buildDayMapUrl,
  mapsTravelModeFor,
  mapsTravelModeForLeg,
  MAPS_MAX_WAYPOINTS,
  type MapsTravelMode,
} from "./mapsLink";
import type {
  GeoPoint,
  LegMode,
  RouteDay,
  RouteDayTotals,
  RouteLeg,
  RouteStop,
  RouteWarning,
} from "./routeTypes";
import {
  baseForDay,
  collectStops,
  sequenceStops,
  type MappedPlace,
} from "./routeStops";

/** A day is demanding at or above this share of its modeled walking ceiling. */
export const DEMANDING_WALK_RATIO = 0.7;

/** A day is demanding when it carries a hike or uses most of its walking ceiling. */
export function isDemandingDay(day: PlannerDay, walkingKm: number): boolean {
  if (day.blocks.some((block) => block.kind === "hike")) return true;
  return day.walkingCapKm > 0 && walkingKm >= DEMANDING_WALK_RATIO * day.walkingCapKm;
}

/** The mode that carries most of the day's minutes, used for the Maps travelmode. */
function dominantTravelMode(
  legs: readonly RouteLeg[],
  transport: TransportMode,
): MapsTravelMode {
  if (legs.length === 0) return mapsTravelModeFor(transport);
  const minutes: Record<LegMode, number> = { walk: 0, transit: 0, car: 0 };
  for (const leg of legs) minutes[leg.mode] += leg.durationMin;
  let best: LegMode = "walk";
  for (const mode of ["transit", "car"] as const) {
    if (minutes[mode] > minutes[best]) best = mode;
  }
  return mapsTravelModeForLeg(best);
}

function sumTotals(
  legs: readonly RouteLeg[],
  stops: readonly RouteStop[],
): RouteDayTotals {
  let distanceKm = 0;
  let durationMin = 0;
  let walkKm = 0;
  let walkMinutes = 0;
  let onSiteMin = 0;
  for (const leg of legs) {
    distanceKm += leg.distanceKm;
    durationMin += leg.durationMin;
    walkKm += leg.walkKm;
    if (leg.mode === "walk") walkMinutes += leg.durationMin;
  }
  for (const stop of stops) onSiteMin += stop.serviceMin;
  return {
    distanceKm: roundKm(distanceKm),
    durationMin,
    walkKm: roundKm(walkKm),
    walkMinutes,
    onSiteMin,
  };
}

/** Builds the legs from the base through each stop in sequence. */
function buildLegs(
  sequenced: readonly RouteStop[],
  base: { point: GeoPoint } | null,
  transport: TransportMode,
  avoidWalking: boolean,
): RouteLeg[] {
  const legs: RouteLeg[] = [];
  let previousId: string | null = base === null ? null : "base";
  let previousPoint: GeoPoint | null = base === null ? null : base.point;
  for (const stop of sequenced) {
    if (previousPoint !== null) {
      legs.push(
        planLeg(
          previousId ?? "base",
          stop.placeId,
          haversineKm(previousPoint, stop),
          transport,
          avoidWalking,
        ),
      );
    }
    previousId = stop.placeId;
    previousPoint = stop;
  }
  return legs;
}

function buildWarnings(
  day: PlannerDay,
  sequenced: readonly RouteStop[],
  legs: readonly RouteLeg[],
  totals: RouteDayTotals,
): RouteWarning[] {
  const warnings: RouteWarning[] = [];
  if (sequenced.length === 0) {
    warnings.push({
      code: "no_coordinates",
      day: day.day,
      message: `Day ${day.day} has no verified coordinates. The route link is unavailable.`,
    });
  }
  if (day.walkingCapKm > 0 && totals.walkKm > day.walkingCapKm) {
    warnings.push({
      code: "walking_over_cap",
      day: day.day,
      message: `Day ${day.day} routes ${totals.walkKm.toFixed(1)} km on foot against a ${day.walkingCapKm.toFixed(1)} km modeled ceiling.`,
    });
  }
  for (const leg of legs) {
    if (isLongWalk(leg.distanceKm, leg.mode)) {
      warnings.push({
        code: "long_walk",
        day: day.day,
        message: `A ${leg.distanceKm.toFixed(1)} km walking leg is long. Split it or choose another mode.`,
      });
      return warnings;
    }
  }
  if (totals.walkKm >= WALK_CAUTION_KM) {
    // Several medium walks can add up to a long one even when no single leg trips the check.
    warnings.push({
      code: "long_walk",
      day: day.day,
      message: `Walking adds up to ${totals.walkKm.toFixed(1)} km today. Keep the recovery window.`,
    });
  }
  return warnings;
}

/** Builds one day's route. */
export function buildRouteDay(
  day: PlannerDay,
  byId: ReadonlyMap<string, MappedPlace>,
  places: readonly PlannerPlace[],
  stays: readonly MappedPlace[],
  fallback: MappedPlace | null,
  transport: TransportMode,
): RouteDay {
  const base = baseForDay(day, stays, fallback);
  const items = collectStops(day, byId, base === null ? null : base.placeId);
  const dose = computePlannerDose([day], places, "concierge")[0];
  const demanding = isDemandingDay(day, dose?.walkingKm ?? 0);
  const avoidWalking = demanding && transport !== "walk";
  const sequenced = sequenceStops(items, base === null ? null : base.point);
  const legs = buildLegs(sequenced, base, transport, avoidWalking);
  const totals = sumTotals(legs, sequenced);
  const warnings = buildWarnings(day, sequenced, legs, totals);

  const link = buildDayMapUrl({
    base: base === null ? null : base.point,
    stops: sequenced,
    travelMode: dominantTravelMode(legs, transport),
  });
  if (link.truncated) {
    warnings.push({
      code: "truncated_link",
      day: day.day,
      message: `The map link shows the first ${MAPS_MAX_WAYPOINTS} stops of this day.`,
    });
  }

  return {
    day: day.day,
    title: day.title,
    restDay: day.restDay,
    base,
    stops: sequenced,
    legs,
    totals,
    demanding,
    walkingCapKm: day.walkingCapKm,
    mapUrl: link.url,
    warnings,
  };
}
