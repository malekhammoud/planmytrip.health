/**
 * Server-side geocoding for verified places that lack coordinates.
 *
 * Inputs: a built AgentTripPlan, the destination label, and an AbortSignal.
 * Outputs: a new plan whose missing coordinates were resolved through Nominatim.
 * Invariants: only place names and addresses are sent; no user identity or health data;
 * at most ten lookups per plan; uncached lookups are spaced one second apart; failures
 * leave coordinates null rather than guessing.
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

function needsCoordinates(place: PlannerPlace): boolean {
  return place.lat === null || place.lng === null;
}

/**
 * Resolves missing coordinates for up to ten places. Lookups run sequentially at one
 * request per second to respect the public Nominatim policy. A failed lookup leaves the
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
    if (cache.has(query)) {
      searched += 1;
      return cache.get(query) ?? null;
    }
    if (searched > 0) await sleep(DELAY_MS, signal);
    const point = await lookup(query, signal);
    searched += 1;
    return point;
  };

  for (const place of targets) {
    const query = queryFor(place, destination);
    if (query.length === 0) continue;
    try {
      let point = await spacedLookup(query);
      if (point === null) {
        point = await spacedLookup(`${place.name}, ${destination}`);
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
