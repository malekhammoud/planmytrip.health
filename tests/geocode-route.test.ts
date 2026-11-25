/**
 * Route tests for the authenticated destination search and reverse lookup.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as search } from "@/app/api/geocode/search/route";
import { GET as reverse } from "@/app/api/geocode/reverse/route";
import { resetGeocodeCacheForTests } from "@/lib/geocode/search";
import { resetLiveLimitsForTests } from "@/lib/liveLimits";

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const feature = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-81.2453, 42.9849] },
  properties: {
    name: "London",
    city: "London",
    state: "Ontario",
    country: "Canada",
    type: "city",
  },
};

beforeEach(() => {
  resetGeocodeCacheForTests();
  resetLiveLimitsForTests();
  vi.stubEnv("GEOCODER_SEARCH_URL", "https://photon.example/api/");
  vi.stubEnv("GEOCODER_REVERSE_URL", "https://photon.example/reverse");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/geocode/search", () => {
  it("returns validated suggestions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ type: "FeatureCollection", features: [feature] }),
    );
    const response = await search(
      new Request("http://localhost/api/geocode/search?q=London%2C%20Ontario&limit=6"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { results: Array<{ label: string }> };
    expect(body.results[0]?.label).toBe("London, Ontario, Canada");
  });

  it("rejects a short or overlong query", async () => {
    expect((await search(new Request("http://localhost/api/geocode/search?q=L"))).status).toBe(400);
    expect(
      (
        await search(
          new Request(`http://localhost/api/geocode/search?q=${"a".repeat(130)}`),
        )
      ).status,
    ).toBe(400);
  });

  it("clamps the requested limit to eight", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ type: "FeatureCollection", features: [feature] }));
    await search(new Request("http://localhost/api/geocode/search?q=London&limit=99"));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("limit=8");
  });

  it("returns 429 when the per-account request bucket is exhausted", async () => {
    vi.stubEnv("PLANMYTRIP_GEOCODE_PER_MINUTE", "1");
    resetLiveLimitsForTests();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json({ type: "FeatureCollection", features: [feature] }));

    const first = await search(
      new Request("http://localhost/api/geocode/search?q=London"),
    );
    expect(first.status).toBe(200);

    const second = await search(
      new Request("http://localhost/api/geocode/search?q=Paris"),
    );
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("60");
    await expect(second.json()).resolves.toMatchObject({ code: "rate_limited" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/geocode/reverse", () => {
  it("returns a named place", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ type: "FeatureCollection", features: [feature] }),
    );
    const response = await reverse(
      new Request("http://localhost/api/geocode/reverse?lat=42.9849&lon=-81.2453&mode=city"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { place: { label: string } };
    expect(body.place.label).toBe("London, Ontario, Canada");
  });

  it("rejects a missing or out-of-range coordinate", async () => {
    expect(
      (await reverse(new Request("http://localhost/api/geocode/reverse?lon=0"))).status,
    ).toBe(400);
    expect(
      (await reverse(new Request("http://localhost/api/geocode/reverse?lat=nope&lon=0"))).status,
    ).toBe(400);
    expect(
      (
        await reverse(
          new Request("http://localhost/api/geocode/reverse?lat=100&lon=0"),
        )
      ).status,
    ).toBe(400);
  });

  it("returns 404 when the provider cannot name the point", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ type: "FeatureCollection", features: [] }),
    );
    const response = await reverse(
      new Request("http://localhost/api/geocode/reverse?lat=42.9849&lon=-81.2453"),
    );
    expect(response.status).toBe(404);
  });
});
