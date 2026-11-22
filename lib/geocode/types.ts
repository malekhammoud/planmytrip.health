/**
 * Shared geocoder contracts for the destination combobox and map picker.
 *
 * Inputs: untrusted JSON from the server geocoder routes.
 * Outputs: validated place suggestions with a display label, city label, and coordinates.
 * Invariants: labels and names are bounded to the destination field's 120-character limit;
 * coordinates are finite and inside the map; malformed rows are dropped, never rendered.
 */

/** One validated geocoder result. */
export interface GeocodePlace {
  /** Full label shown in the destination field. */
  label: string;
  /** City-level label used by "use current location". */
  cityLabel: string;
  /** Place or city name without the administrative suffix. */
  name: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
  /** Provider place type, such as city, house, or hotel. */
  kind: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length === 0 ? null : text.slice(0, max);
}

function asCoordinate(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

/** Human label for a provider place type, or null when there is no useful type. */
export function describePlaceKind(kind: string | null): string | null {
  if (kind === null) return null;
  const token = kind.toLowerCase();
  if (token === "city" || token === "town" || token === "village" || token === "municipality") {
    return "City";
  }
  if (token === "house" || token === "street" || token === "address") return "Address";
  if (token === "locality" || token === "district" || token === "county") return "Area";
  return token
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 40);
}

/** Narrows one untrusted place object. */
export function parseGeocodePlace(value: unknown): GeocodePlace | null {
  if (!isRecord(value)) return null;
  const label = asText(value.label, 120);
  const cityLabel = asText(value.cityLabel, 120) ?? label;
  const name = asText(value.name, 120);
  const lat = asCoordinate(value.lat, -90, 90);
  const lng = asCoordinate(value.lng, -180, 180);
  if (label === null || cityLabel === null || name === null || lat === null || lng === null) {
    return null;
  }
  return {
    label,
    cityLabel,
    name,
    city: asText(value.city, 80),
    region: asText(value.region, 80),
    country: asText(value.country, 80),
    lat,
    lng,
    kind: asText(value.kind, 40),
  };
}

/** Narrows a search response and keeps at most the eight documented rows. */
export function parseGeocodeResults(value: unknown): GeocodePlace[] {
  if (!isRecord(value) || !Array.isArray(value.results)) return [];
  const results: GeocodePlace[] = [];
  for (const row of value.results.slice(0, 8)) {
    const place = parseGeocodePlace(row);
    if (place !== null) results.push(place);
  }
  return results;
}

/** Narrows a reverse response. */
export function parseGeocodePlaceResponse(value: unknown): GeocodePlace | null {
  if (!isRecord(value)) return null;
  return parseGeocodePlace(value.place);
}
