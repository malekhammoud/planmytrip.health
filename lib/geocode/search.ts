/**
 * Server-side destination search and reverse lookup for onboarding.
 *
 * Inputs: a short city or place query, or a map coordinate pair.
 * Outputs: bounded, validated geocoder suggestions with a city-level label.
 * Invariants: only the query or coordinate leaves the server; no account id, health input,
 * or cookie is forwarded; results are cached in process for ten minutes; provider errors
 * become empty results, never raw upstream text.
 */

import type { GeocodePlace } from "./types";

const DEFAULT_USER_AGENT =
  "PlanMyTrip.health/0.1 (travel planning; contact@planmytrip.health)";
const DEFAULT_NOMINATIM = "https://nominatim.openstreetmap.org/search";
const DEFAULT_NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const TIMEOUT_MS = 6_000;
const SEARCH_LIMIT_MAX = 8;
const CACHE_LIMIT = 160;
const SEARCH_TTL_MS = 10 * 60 * 1_000;
const REVERSE_TTL_MS = 60 * 60 * 1_000;

interface SearchCacheEntry {
  at: number;
  ttl: number;
  value: GeocodePlace[];
}

interface ReverseCacheEntry {
  at: number;
  ttl: number;
  value: GeocodePlace | null;
}

const searchCache = new Map<string, SearchCacheEntry>();
const reverseCache = new Map<string, ReverseCacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function remember<T extends { at: number }>(cache: Map<string, T>, key: string, value: T): void {
  if (cache.size >= CACHE_LIMIT && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function userAgent(): string {
  return process.env.NOMINATIM_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

// VERIFY: The onboarding autocomplete and reverse lookup use Photon's public API in
// production today. Confirm its licence, quota, attribution, and retention terms before a
// paid launch, or point GEOCODER_SEARCH_URL and GEOCODER_REVERSE_URL at a licensed provider.


function searchProvider(): "photon" | "nominatim" {
  const configured =
    process.env.GEOCODER_SEARCH_URL?.trim() ||
    process.env.GEOCODER_FALLBACK_URL?.trim();
  return configured === undefined || configured.length === 0 ? "nominatim" : "photon";
}

function photonSearchBase(): string {
  return (
    process.env.GEOCODER_SEARCH_URL?.trim() ||
    process.env.GEOCODER_FALLBACK_URL?.trim() ||
    ""
  );
}

function photonReverseBase(): string {
  const explicit = process.env.GEOCODER_REVERSE_URL?.trim();
  if (explicit !== undefined && explicit.length > 0) return explicit;
  const search = photonSearchBase();
  if (search.length === 0) return "";
  return search.replace(/\/api\/?$/, "/reverse");
}

function nominatimSearchBase(): string {
  return process.env.NOMINATIM_URL?.trim() || DEFAULT_NOMINATIM;
}

function nominatimReverseBase(): string {
  const search = nominatimSearchBase();
  if (search.includes("/search")) return search.replace(/\/search\/?$/, "/reverse");
  return DEFAULT_NOMINATIM_REVERSE;
}

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function asText(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length === 0 ? null : text.slice(0, max);
}

function asCoordinate(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function uniqueParts(parts: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    if (part === null) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(part);
  }
  return result;
}

function fitLabel(parts: readonly (string | null)[]): string | null {
  let label = "";
  for (const part of uniqueParts(parts)) {
    const next = label.length === 0 ? part : `${label}, ${part}`;
    if (next.length > 120) break;
    label = next;
  }
  return label.length > 0 ? label : null;
}


function photonPlace(feature: unknown): GeocodePlace | null {
  if (!isRecord(feature)) return null;
  const properties = isRecord(feature.properties) ? feature.properties : {};
  const geometry = isRecord(feature.geometry) ? feature.geometry : {};
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lng = asCoordinate(coordinates[0], -180, 180);
  const lat = asCoordinate(coordinates[1], -90, 90);
  if (lat === null || lng === null) return null;

  const street = asText(properties.street, 100);
  const house = asText(properties.housenumber, 20);
  const addressLine = [house, street].filter(Boolean).join(" ");
  const city =
    asText(properties.city, 80) ??
    asText(properties.town, 80) ??
    asText(properties.village, 80) ??
    asText(properties.municipality, 80) ??
    asText(properties.district, 80) ??
    asText(properties.county, 80);
  const region =
    asText(properties.state, 80) ??
    asText(properties.county, 80) ??
    asText(properties.district, 80);
  const country = asText(properties.country, 80);
  const kind =
    asText(properties.type, 40) ??
    asText(properties.osm_value, 40) ??
    "place";
  const name =
    asText(properties.name, 120) ??
    asText(addressLine, 120) ??
    city ??
    asText(properties.state, 80);
  if (name === null) return null;
  const cityLike =
    kind === "city" || kind === "town" || kind === "village" || kind === "municipality";
  const label =
    fitLabel([name, ...(cityLike ? [] : [city]), region, country]) ?? null;
  if (label === null) return null;
  const cityLabel = fitLabel([cityLike ? name : city ?? null, region, country]) ?? label;
  return { label, cityLabel, name, city, region, country, lat, lng, kind };
}

function nominatimPlace(record: unknown): GeocodePlace | null {
  if (!isRecord(record)) return null;
  const lat = asCoordinate(Number(record.lat), -90, 90);
  const lng = asCoordinate(Number(record.lon), -180, 180);
  if (lat === null || lng === null) return null;
  const address = isRecord(record.address) ? record.address : {};
  const city =
    asText(address.city, 80) ??
    asText(address.town, 80) ??
    asText(address.village, 80) ??
    asText(address.municipality, 80) ??
    asText(address.city_district, 80) ??
    asText(address.county, 80);
  const region = asText(address.state, 80) ?? asText(address.county, 80);
  const country = asText(address.country, 80);
  const name =
    asText(address.amenity, 120) ??
    asText(address.shop, 120) ??
    asText(address.tourism, 120) ??
    asText(address.building, 120) ??
    asText(address.house_name, 120) ??
    asText(address.road, 120) ??
    asText(record.display_name, 120)?.split(",")[0]?.trim() ??
    city;
  if (name === null) return null;
  const kind = asText(record.type, 40) ?? "place";
  const label = fitLabel([name, city, region, country]) ?? asText(record.display_name, 120);
  if (label === null) return null;
  const cityLabel = fitLabel([city ?? (kind === "city" ? name : null), region, country]) ?? label;
  return { label, cityLabel, name, city, region, country, lat, lng, kind };
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function dedupePlaces(places: readonly GeocodePlace[], limit: number): GeocodePlace[] {
  const seen = new Set<string>();
  const result: GeocodePlace[] = [];
  for (const place of places) {
    const key = `${place.label.toLowerCase()}|${place.lat.toFixed(3)}|${place.lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
    if (result.length >= limit) break;
  }
  return result;
}

/** Searches cities and places for the destination combobox. */
export async function searchPlaces(query: string, limit = 6): Promise<GeocodePlace[]> {
  const text = normalizeQuery(query);
  if (text.length < 2) return [];
  const bounded = Math.max(1, Math.min(SEARCH_LIMIT_MAX, Math.trunc(limit)));
  const provider = searchProvider();
  const cacheKey = `${provider}:${text.toLowerCase()}:${bounded}`;
  const cached = searchCache.get(cacheKey);
  if (cached !== undefined && Date.now() - cached.at < cached.ttl) return cached.value;

  let places: GeocodePlace[] = [];
  if (provider === "photon") {
    const base = photonSearchBase();
    const url = `${base}${base.includes("?") ? "&" : "?"}q=${encodeURIComponent(text)}&limit=${bounded}&lang=en`;
    const body = await fetchJson(url);
    if (isRecord(body) && Array.isArray(body.features)) {
      places = body.features.map(photonPlace).filter((place): place is GeocodePlace => place !== null);
    }
  } else {
    const url = `${nominatimSearchBase()}${nominatimSearchBase().includes("?") ? "&" : "?"}format=jsonv2&addressdetails=1&limit=${bounded}&q=${encodeURIComponent(text)}`;
    const body = await fetchJson(url);
    if (Array.isArray(body)) {
      places = body.map(nominatimPlace).filter((place): place is GeocodePlace => place !== null);
    }
  }
  const value = dedupePlaces(places, bounded);
  remember(searchCache, cacheKey, {
    at: Date.now(),
    ttl: value.length > 0 ? SEARCH_TTL_MS : 2 * 60 * 1_000,
    value,
  });
  return value;
}

/** Resolves one map coordinate to a place and city label. */
export async function reversePlace(
  lat: number,
  lng: number,
  mode: "city" | "place" = "place",
): Promise<GeocodePlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}:${mode}`;
  const cached = reverseCache.get(key);
  if (cached !== undefined && Date.now() - cached.at < cached.ttl) return cached.value;

  const reverseBase = photonReverseBase();
  let place: GeocodePlace | null = null;
  if (reverseBase.length > 0) {
    const url = `${reverseBase}${reverseBase.includes("?") ? "&" : "?"}lat=${lat}&lon=${lng}&limit=1&lang=en`;
    const body = await fetchJson(url);
    if (isRecord(body) && Array.isArray(body.features)) {
      place = body.features.map(photonPlace)[0] ?? null;
    }
  } else {
    const url = `${nominatimReverseBase()}${nominatimReverseBase().includes("?") ? "&" : "?"}format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
    place = nominatimPlace(await fetchJson(url));
  }
  if (place !== null && mode === "city") {
    place = { ...place, label: place.cityLabel };
  }
  remember(reverseCache, key, {
    at: Date.now(),
    ttl: place === null ? 2 * 60 * 1_000 : REVERSE_TTL_MS,
    value: place,
  });
  return place;
}

/** Clears the process cache; used by tests. */
export function resetGeocodeCacheForTests(): void {
  searchCache.clear();
  reverseCache.clear();
}
