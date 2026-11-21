/**
 * Great-circle geometry for the travel-route planner.
 *
 * Inputs: coordinate pairs. Outputs: distances in kilometres and derived shapes.
 * Invariants: pure, deterministic, no I/O; distances are straight-line great-circle
 * values, so a modeled leg always underestimates the real street distance and is
 * presented as an estimate, never as a measurement.
 */

import type { GeoPoint } from "./routeTypes";

/** Mean Earth radius in kilometres (IUGG). */
const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const latFrom = toRadians(from.lat);
  const latTo = toRadians(to.lat);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latFrom) * Math.cos(latTo) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rounds a distance to 10 metres, the precision the panel and links display. */
export function roundKm(km: number): number {
  return Math.round(km * 100) / 100;
}

/** Length of an open path that visits the points in order. */
export function pathLengthKm(points: readonly GeoPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineKm(points[index - 1], points[index]);
  }
  return total;
}

/** Geometric centre of the points, or null for an empty list. */
export function centroid(points: readonly GeoPoint[]): GeoPoint | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const point of points) {
    lat += point.lat;
    lng += point.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}
