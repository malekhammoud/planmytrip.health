/**
 * Per-leg mode choice and modeled travel time.
 *
 * Inputs: the straight-line distance of a leg, the traveler's transport mode, and whether
 * the day is already demanding enough to avoid extra walking.
 * Outputs: one resolved leg mode, a modeled duration, and the walking distance it adds.
 * Invariants: no live schedule or routing service is consulted; a vehicle leg adds no
 * walking; a walk-only trip never silently switches mode; every assumed speed lives here.
 */

import type { LegMode, RouteLeg } from "./routeTypes";
import { roundKm } from "./geometry";
import type { TransportMode } from "../types";

/**
 * Assumed average speeds, in km/h, including stops but not access overhead. These are
 * planning assumptions, not measured values.
 */
// VERIFY: 4.5 km/h walking, 18 km/h urban transit, and 32 km/h city driving are product
// assumptions. Confirm them against the destinations this product serves, and confirm that
// a straight-line distance underestimates street distance in a way the UI labels clearly.
export const LEG_SPEEDS_KPH = {
  walk: 4.5,
  transit: 18,
  car: 32,
} as const satisfies Record<LegMode, number>;

/** Fixed minutes for access, waiting, and parking, per mode. */
export const LEG_OVERHEAD_MIN = {
  walk: 0,
  transit: 8,
  car: 5,
} as const satisfies Record<LegMode, number>;

/** A leg at or below this distance is walked whenever the mode allows it. */
export const WALK_SHORT_LEG_KM = 1.2;

/** A car trip at or below this distance is walked instead. */
export const CAR_SHORT_LEG_KM = 0.8;

/** Above this distance, mixed transport prefers a car over transit. */
export const TRANSIT_LONG_LEG_KM = 12;

/** A single walking leg at or above this distance is flagged for review. */
export const WALK_CAUTION_KM = 2.5;

/** On a demanding day, legs above this distance avoid walking when a vehicle is allowed. */
export const AVOID_WALK_FLOOR_KM = 0.6;

/**
 * Chooses the mode for one leg. `avoidWalking` is set on demanding days so the route does
 * not add walking to a day that is already at its ceiling; a walk-only traveler keeps
 * walking because the mode they chose has no alternative.
 */
export function chooseLegMode(
  distanceKm: number,
  transport: TransportMode,
  avoidWalking = false,
): LegMode {
  if (transport === "walk") return "walk";
  if (avoidWalking && distanceKm > AVOID_WALK_FLOOR_KM) {
    if (transport === "car") return "car";
    return distanceKm <= TRANSIT_LONG_LEG_KM ? "transit" : "car";
  }
  switch (transport) {
    case "car":
      return distanceKm <= CAR_SHORT_LEG_KM ? "walk" : "car";
    case "transit":
      return distanceKm <= WALK_SHORT_LEG_KM ? "walk" : "transit";
    case "mixed":
      if (distanceKm <= WALK_SHORT_LEG_KM) return "walk";
      return distanceKm <= TRANSIT_LONG_LEG_KM ? "transit" : "car";
  }
}

/**
 * Modeled duration for one leg. A vehicle leg rounds up to at least a minute so a short
 * hop never renders as zero, and transit and car legs carry their access overhead.
 */
export function legDurationMin(distanceKm: number, mode: LegMode): number {
  const travel = (distanceKm / LEG_SPEEDS_KPH[mode]) * 60;
  return Math.max(1, Math.ceil(travel + LEG_OVERHEAD_MIN[mode]));
}

/** True when one walking leg is long enough to warrant a caution. */
export function isLongWalk(distanceKm: number, mode: LegMode): boolean {
  return mode === "walk" && distanceKm >= WALK_CAUTION_KM;
}

/** Builds one resolved leg between two known ids. */
export function planLeg(
  from: string,
  to: string,
  distanceKm: number,
  transport: TransportMode,
  avoidWalking: boolean,
): RouteLeg {
  const distance = roundKm(distanceKm);
  const mode = chooseLegMode(distance, transport, avoidWalking);
  return {
    from,
    to,
    mode,
    distanceKm: distance,
    durationMin: legDurationMin(distance, mode),
    walkKm: mode === "walk" ? distance : 0,
  };
}
