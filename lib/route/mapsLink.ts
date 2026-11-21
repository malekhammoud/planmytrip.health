/**
 * Google Maps handoff links for one day and for the trip's arrival.
 *
 * Inputs: a base point (the stay), the day's ordered stops, the resolved travel mode, and
 * for the arrival link two free-text place labels.
 * Outputs: a Maps URLs deep link plus whether stops had to be dropped.
 * Invariants: no API key, no geocoding, and no request from this module; every coordinate
 * is printed with six decimals; the waypoint count never exceeds the documented limit; a
 * link that cannot be built returns null instead of a broken URL.
 */

import type { GeoPoint, LegMode } from "./routeTypes";

/**
 * Google's Maps URLs reference allows up to nine waypoints between the origin and the
 * destination. Origin and destination are additional, so a loop link can carry nine stops.
 */
// VERIFY: Confirm the nine-waypoint limit and the travelmode values against Google's Maps
// URLs reference before launch, and confirm the terms permit this deep-link handoff.
export const MAPS_MAX_WAYPOINTS = 9;

const MAPS_ENDPOINT = "https://www.google.com/maps/dir/?api=1";

/** Travel modes the Maps URLs endpoint accepts. There is no mode for a mixed trip. */
export type MapsTravelMode = "walking" | "transit" | "driving";

/** One built link and whether the stop list had to be truncated. */
export interface MapLink {
  url: string | null;
  truncated: boolean;
}

/** Maps travel mode for a transport preference; mixed is resolved per day by its legs. */
export function mapsTravelModeFor(
  transport: "walk" | "transit" | "car" | "mixed",
): MapsTravelMode {
  switch (transport) {
    case "walk":
      return "walking";
    case "transit":
      return "transit";
    case "car":
    case "mixed":
      return "driving";
  }
}

/** Maps travel mode for a resolved leg mode. */
export function mapsTravelModeForLeg(mode: LegMode): MapsTravelMode {
  switch (mode) {
    case "walk":
      return "walking";
    case "transit":
      return "transit";
    case "car":
      return "driving";
  }
}

function coordinate(point: GeoPoint): string {
  return encodeURIComponent(`${point.lat.toFixed(6)},${point.lng.toFixed(6)}`);
}

/**
 * Builds a day link. With a base it is a loop: origin and destination are the stay and the
 * stops are waypoints, so Maps draws the whole day. Without a base it is an open path from
 * the first stop to the last, because the day has no known anchor.
 */
export function buildDayMapUrl(input: {
  base: GeoPoint | null;
  stops: readonly GeoPoint[];
  travelMode: MapsTravelMode;
}): MapLink {
  const { base, stops, travelMode } = input;
  if (base !== null) {
    if (stops.length === 0) return { url: null, truncated: false };
    const kept = stops.slice(0, MAPS_MAX_WAYPOINTS);
    const params = [
      `origin=${coordinate(base)}`,
      `destination=${coordinate(base)}`,
      `waypoints=${kept.map(coordinate).join("%7C")}`,
      `travelmode=${travelMode}`,
      "dir_action=navigate",
    ];
    return {
      url: `${MAPS_ENDPOINT}&${params.join("&")}`,
      truncated: stops.length > MAPS_MAX_WAYPOINTS,
    };
  }
  if (stops.length < 2) return { url: null, truncated: false };
  const first = stops[0];
  const last = stops[stops.length - 1];
  const middle = stops.slice(1, -1);
  const kept = middle.slice(0, MAPS_MAX_WAYPOINTS);
  const params = [
    `origin=${coordinate(first)}`,
    `destination=${coordinate(last)}`,
    ...(kept.length > 0
      ? [`waypoints=${kept.map(coordinate).join("%7C")}`]
      : []),
    `travelmode=${travelMode}`,
    "dir_action=navigate",
  ];
  return {
    url: `${MAPS_ENDPOINT}&${params.join("&")}`,
    truncated: middle.length > MAPS_MAX_WAYPOINTS,
  };
}

/**
 * Builds the arrival link from the traveler's origin label to the base. Labels are free
 * text because Google resolves them; this module never geocodes the origin.
 */
export function buildArrivalMapUrl(input: {
  origin: string;
  destination: string;
  travelMode: MapsTravelMode;
}): string | null {
  const origin = input.origin.trim();
  const destination = input.destination.trim();
  if (origin.length === 0 || destination.length === 0) return null;
  const params = [
    `origin=${encodeURIComponent(origin)}`,
    `destination=${encodeURIComponent(destination)}`,
    `travelmode=${input.travelMode}`,
    "dir_action=navigate",
  ];
  return `${MAPS_ENDPOINT}&${params.join("&")}`;
}
