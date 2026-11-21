/**
 * Wire and presentation types for the travel-route planner.
 *
 * Inputs: none. Outputs: stops, legs, day routes, warnings, and the complete TripRoute
 * rendered by the route panel and drawn by the map.
 * Invariants: every stop carries verified coordinates; a route never invents a place;
 * every warning names its day and a calm, actionable sentence; totals are derived from
 * legs, never from an agent estimate.
 */

import type { PlaceCategory } from "../agent/agentTypes";
import type { TransportMode } from "../types";

/** A coordinate pair with no place identity. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** How one leg is actually travelled. */
export type LegMode = "walk" | "transit" | "car";

/** One ordered stop in a day's route. */
export interface RouteStop extends GeoPoint {
  placeId: string;
  name: string;
  category: PlaceCategory;
  /** Time spent at the stop from the concierge block duration, in minutes. */
  serviceMin: number;
}

/** One movement between the base, a stop, or the previous stop. */
export interface RouteLeg {
  /** A place id, or "base" for the stay that anchors the day. */
  from: string;
  to: string;
  mode: LegMode;
  distanceKm: number;
  durationMin: number;
  /** Walking distance contributed by this leg; zero for a vehicle leg. */
  walkKm: number;
}

/** Stable reasons the route panel can show a caution. */
export type RouteWarningCode =
  | "no_coordinates"
  | "walking_over_cap"
  | "pacing_adjacent"
  | "long_walk"
  | "truncated_link";

/** One calm caution attached to a day or to the whole trip. */
export interface RouteWarning {
  code: RouteWarningCode;
  message: string;
  day: number | null;
}

/** Modeled totals for one day. */
export interface RouteDayTotals {
  distanceKm: number;
  durationMin: number;
  walkKm: number;
  walkMinutes: number;
  onSiteMin: number;
}

/** One day's route: base, ordered stops, legs, totals, and the map handoff. */
export interface RouteDay {
  day: number;
  title: string;
  restDay: boolean;
  base: { placeId: string; name: string; point: GeoPoint } | null;
  stops: RouteStop[];
  legs: RouteLeg[];
  totals: RouteDayTotals;
  /** True for a hike day or a day at or above 70% of its walking ceiling. */
  demanding: boolean;
  walkingCapKm: number;
  /** Google Maps URL for the day, or null when coordinates are missing. */
  mapUrl: string | null;
  warnings: RouteWarning[];
}

/** Complete planned route for one trip. */
export interface TripRoute {
  transport: TransportMode;
  origin: string;
  days: RouteDay[];
  totals: RouteDayTotals;
  /** Arrival link from the traveler's origin to the base, or null. */
  mapUrl: string | null;
  warnings: RouteWarning[];
}

/** Human labels for leg modes, shared by the route panel and tests. */
export const LEG_MODE_LABELS = {
  walk: "Walk",
  transit: "Transit",
  car: "Car",
} as const satisfies Record<LegMode, string>;
