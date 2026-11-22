/**
 * Geocoder provider tests: Photon parsing, city labels, dedupe, and Nominatim fallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetGeocodeCacheForTests, reversePlace, searchPlaces } from "./search";

function photonFeature(overrides: Record<string, unknown> = {}, coordinates = [-81.2453, 42.9849]) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates },
    properties: {
      name: "London",
      city: "London",
      state: "Ontario",
      country: "Canada",
      type: "city",
      ...overrides,
    },
  };
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  resetGeocodeCacheForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("searchPlaces", () => {
  it("reads Photon cities with a city-level label", async () => {
    vi.stubEnv("GEOCODER_SEARCH_URL", "https://photon.example/api/");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ type: "FeatureCollection", features: [photonFeature()] }));
    const results = await searchPlaces("London", 6);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      label: "London, Ontario, Canada",
      cityLabel: "London, Ontario, Canada",
      lat: 42.9849,
      lng: -81.2453,
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("photon.example");
    expect(url).toContain("q=London");
    expect(url).toContain("limit=6");
  });

  it("keeps the city name when the provider returns a broader region", async () => {
    vi.stubEnv("GEOCODER_SEARCH_URL", "https://photon.example/api/");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        features: [
          photonFeature({
            name: "London",
            city: "Southwestern Ontario",
            state: "Ontario",
            country: "Canada",
          }),
        ],
      }),
    );
    const results = await searchPlaces("London region", 6);
    expect(results[0]?.label).toBe("London, Ontario, Canada");
    expect(results[0]?.cityLabel).toBe("London, Ontario, Canada");
  });

  it("deduplicates identical rows and honours the limit", async () => {
    vi.stubEnv("GEOCODER_SEARCH_URL", "https://photon.example/api/");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        features: [
          photonFeature(),
          photonFeature(),
          photonFeature({ name: "London", city: "London", country: "United Kingdom" }, [-0.1276, 51.5072]),
        ],
      }),
    );
    const results = await searchPlaces("London unique", 1);
    expect(results).toHaveLength(1);
  });

  it("falls back to Nominatim when no Photon endpoint is configured", async () => {
    vi.stubEnv("GEOCODER_SEARCH_URL", "");
    vi.stubEnv("GEOCODER_FALLBACK_URL", "");
    vi.stubEnv("NOMINATIM_URL", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json([
        {
          lat: "42.9849",
          lon: "-81.2453",
          display_name: "London, Middlesex County, Ontario, Canada",
          type: "city",
          address: {
            city: "London",
            state: "Ontario",
            country: "Canada",
          },
        },
      ]),
    );
    const results = await searchPlaces("London unique two", 6);
    expect(results[0]?.label).toBe("London, Ontario, Canada");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("format=jsonv2");
  });

  it("returns no rows for a one-character query without fetching", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await searchPlaces("L")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reversePlace", () => {
  it("returns the city label for current location", async () => {
    vi.stubEnv("GEOCODER_REVERSE_URL", "https://photon.example/reverse");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ features: [photonFeature()] }),
    );
    const place = await reversePlace(42.9849, -81.2453, "city");
    expect(place?.label).toBe("London, Ontario, Canada");
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("photon.example/reverse");
    expect(url).toContain("lat=42.9849");
  });

  it("returns the exact place label for a map pin", async () => {
    vi.stubEnv("GEOCODER_REVERSE_URL", "https://photon.example/reverse");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        features: [
          photonFeature({
            name: "Museum London",
            housenumber: "421",
            street: "Ridout Street North",
            type: "museum",
          }),
        ],
      }),
    );
    const place = await reversePlace(42.983, -81.2544, "place");
    expect(place?.label).toBe(
      "Museum London, London, Ontario, Canada",
    );
  });

  it("falls back to Nominatim reverse without a Photon endpoint", async () => {
    vi.stubEnv("GEOCODER_REVERSE_URL", "");
    vi.stubEnv("GEOCODER_SEARCH_URL", "");
    vi.stubEnv("GEOCODER_FALLBACK_URL", "");
    vi.stubEnv("NOMINATIM_URL", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({
        lat: "42.983",
        lon: "-81.2544",
        display_name: "Museum London, 421 Ridout Street North, London, Ontario, Canada",
        type: "museum",
        address: {
          tourism: "Museum London",
          city: "London",
          state: "Ontario",
          country: "Canada",
        },
      }),
    );
    const place = await reversePlace(42.983, -81.2544, "place");
    expect(place?.label).toBe("Museum London, London, Ontario, Canada");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/reverse");
  });

  it("rejects a coordinate outside the map without fetching", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await reversePlace(100, 0)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
