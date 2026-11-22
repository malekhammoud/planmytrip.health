/**
 * Server-side geocoding for verified places that lack coordinates.
 *
 * Inputs: a built AgentTripPlan, the destination label, and an AbortSignal.
 * Outputs: a new plan whose missing coordinates were resolved through Nominatim and an
 * optional configured fallback geocoder.
 * Invariants: only place names and addresses are sent; no user identity or health data;
 * at most ten lookups per plan; uncached lookups are spaced one second apart; failures
 * leave coordinates null rather than guessing; a fallback result must name the
 * destination city.
 */

import type { AgentTripPlan, PlannerPlace } from "./agentTypes";

// VERIFY: The public Nominatim endpoint is limited to one request per second and
// requires a valid identifying User-Agent. Confirm the production geocoder's licence,
// quota, and attribution with the chosen provider before launch.
const DEFAULT_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_USER_AGENT =
  "PlanMyTrip.health/0.1 (travel planning; contact@planmytrip.health)";
const LOOKUP_LIMIT = 10;
const DELAY_MS = 1_000;
const TIMEOUT_MS = 7_000;

interface Point {
  lat: number;
  lng: number;
}

const cache = new Map<string, Point | null>();
const CACHE_LIMIT = 500;

function remember(query: string, point: Point | null): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(query, point);
}

function endpoint(): string {
  return process.env.NOMINATIM_URL?.trim() || DEFAULT_URL;
}

function fallbackEndpoint(): string {
  return process.env.GEOCODER_FALLBACK_URL?.trim() || "";
}

function userAgent(): string {
  return process.env.NOMINATIM_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

function queryFor(place: PlannerPlace, destination: string): string {
  const parts = [place.name, place.address, place.area, destination]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  return parts.join(", ").slice(0, 300);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function parsePoint(value: unknown): Point | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first: unknown = value[0];
  if (typeof first !== "object" || first === null) return null;
  const record = first as Record<string, unknown>;
  const lat = typeof record.lat === "string" ? Number(record.lat) : NaN;
  const lng = typeof record.lon === "string" ? Number(record.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesDestination(value: unknown, destination: string): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const city = destination.toLowerCase().split(/[^a-z0-9]+/).find(Boolean);
  if (city === undefined) return true;
  const properties = value as Record<string, unknown>;
  const place = [
    properties.city,
    properties.town,
    properties.village,
    properties.county,
    properties.state,
    properties.country,
  ]
    .map(asText)
    .filter(Boolean)
    .join(" ");
  return place.includes(city);
}

function parseFallbackPoint(value: unknown, destination: string): Point | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const features = (value as Record<string, unknown>).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const first: unknown = features[0];
  if (typeof first !== "object" || first === null) return null;
  const feature = first as Record<string, unknown>;
  if (!matchesDestination(feature.properties, destination)) return null;
  const geometry = feature.geometry;
  if (typeof geometry !== "object" || geometry === null) return null;
  const coordinates = (geometry as Record<string, unknown>).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lng = typeof coordinates[0] === "number" ? coordinates[0] : NaN;
  const lat = typeof coordinates[1] === "number" ? coordinates[1] : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

async function lookup(query: string, signal: AbortSignal): Promise<Point | null> {
  if (cache.has(query)) return cache.get(query) ?? null;
  const url = `${endpoint()}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
        "Accept-Language": "en",
      },
      signal: AbortSignal.any([signal, timeout]),
      cache: "no-store",
    });
    if (!response.ok) {
      remember(query, null);
      return null;
    }
    const point = parsePoint(await response.json());
    remember(query, point);
    return point;
  } catch {
    return null;
  }
}

// VERIFY: The optional fallback uses Photon's public demo API in production today. Confirm
// its licence, quota, attribution, and data-retention terms before a paid launch, or point
// GEOCODER_FALLBACK_URL at a licensed provider with the same GeoJSON shape.
async function lookupFallback(
  query: string,
  destination: string,
  signal: AbortSignal,
): Promise<Point | null> {
  const base = fallbackEndpoint();
  if (base.length === 0) return null;
  const key = `photon:${query}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const url = `${base}?limit=1&q=${encodeURIComponent(query)}`;
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
        "Accept-Language": "en",
      },
      signal: AbortSignal.any([signal, timeout]),
      cache: "no-store",
    });
    if (!response.ok) {
      remember(key, null);
      return null;
    }
    const point = parseFallbackPoint(await response.json(), destination);
    remember(key, point);
    return point;
  } catch {
    return null;
  }
}

function needsCoordinates(place: PlannerPlace): boolean {
  return place.lat === null || place.lng === null;
}

/**
 * Resolves missing coordinates for up to ten places. Lookups run sequentially at one
 * request per second to respect the public geocoder policies. A failed lookup leaves the
 * place null and the rest of the plan unchanged.
 */
export async function geocodePlan(
  plan: AgentTripPlan,
  destination: string,
  signal: AbortSignal,
): Promise<AgentTripPlan> {
  const targets = plan.places
    .filter(
      (place) =>
        needsCoordinates(place) &&
        (place.category === "stay" ||
          place.category === "eat" ||
          place.category === "hike" ||
          place.category === "visit" ||
          place.category === "care"),
    )
    .slice(0, LOOKUP_LIMIT);
  if (targets.length === 0 || signal.aborted) return plan;

  const points = new Map<string, Point>();
  let searched = 0;
  const spacedLookup = async (query: string): Promise<Point | null> => {
    if (cache.has(query) || cache.has(`photon:${query}`)) {
      return cache.get(query) ?? cache.get(`photon:${query}`) ?? null;
    }
    if (searched > 0) await sleep(DELAY_MS, signal);
    const primary = await lookup(query, signal);
    if (primary !== null) {
      searched += 1;
      return primary;
    }
    await sleep(DELAY_MS, signal);
    const fallback = await lookupFallback(query, destination, signal);
    searched += 1;
    return fallback;
  };

  for (const place of targets) {
    const queries = [
      queryFor(place, destination),
      ...(place.address === null || place.address.trim().length === 0
        ? []
        : [`${place.address}, ${destination}`]),
      `${place.name}, ${destination}`,
    ].filter((query, index, all) => query.length > 0 && all.indexOf(query) === index);
    try {
      let point: Point | null = null;
      for (const query of queries) {
        point = await spacedLookup(query);
        if (point !== null) break;
      }
      if (point !== null) points.set(place.id, point);
    } catch {
      break;
    }
    if (signal.aborted) break;
  }
  if (points.size === 0) return plan;

  return {
    ...plan,
    places: plan.places.map((place) => {
      const point = points.get(place.id);
      return point === undefined
        ? place
        : { ...place, lat: point.lat, lng: point.lng, geocoded: true as const };
    }),
  };
}
