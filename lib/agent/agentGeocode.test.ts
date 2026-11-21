import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodePlan } from "./agentGeocode";
import type { AgentTripPlan, PlannerPlace } from "./agentTypes";

function place(overrides: Partial<PlannerPlace> = {}): PlannerPlace {
  return {
    id: "place-1",
    name: "Museum C",
    category: "visit",
    area: "Museum quarter",
    lat: null,
    lng: null,
    why: "Quiet galleries.",
    notes: null,
    priceBand: null,
    durationMin: 60,
    nights: null,
    distanceKm: null,
    elevationM: null,
    difficulty: null,
    booking: null,
    sourceUrl: "https://example.com/museum",
    address: null,
    phone: null,
    careType: null,
    day: 2,
    ...overrides,
  };
}

function plan(places: PlannerPlace[]): AgentTripPlan {
  return {
    summary: "A plan.",
    baseArea: "",
    routeTheme: "",
    days: [],
    places,
    safetyNotes: [],
    bookingChecklist: [],
    budget: { level: "balanced", estimatedTotal: null, currency: "CAD", notes: "" },
    sources: [],
    generatedAt: "2026-11-21T10:00:00.000Z",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("geocodePlan", () => {
  it("fills a missing coordinate from the geocoder", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ lat: "38.7", lon: "-9.1" }]), { status: 200 }),
      );
    const result = await geocodePlan(
      plan([place({ name: "Unique Museum 21" })]),
      "Lisbon, Portugal",
      new AbortController().signal,
    );
    expect(result.places[0]).toMatchObject({
      lat: 38.7,
      lng: -9.1,
      geocoded: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("Unique%20Museum%2021");
    expect(String(url)).toContain("format=jsonv2");
    expect((options as RequestInit | undefined)?.headers).toMatchObject({
      "Accept-Language": "en",
    });
  });

  it("retries with the simpler name and destination query", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("no", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ lat: "38.7", lon: "-9.1" }]), { status: 200 }),
      );
    const result = await geocodePlan(
      plan([place({ name: "Unique Museum 24" })]),
      "Lisbon, Portugal",
      new AbortController().signal,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.places[0]).toMatchObject({ lat: 38.7, lng: -9.1, geocoded: true });
  });

  it("leaves the place null when the lookup fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 503 }));
    const result = await geocodePlan(
      plan([place({ name: "Unique Museum 22" })]),
      "Lisbon, Portugal",
      new AbortController().signal,
    );
    expect(result.places[0]?.lat).toBeNull();
    expect(result.places[0]?.geocoded).toBeUndefined();
  });

  it("does not call the network for places that already have coordinates", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await geocodePlan(
      plan([place({ lat: 38.7, lng: -9.1 })]),
      "Lisbon, Portugal",
      new AbortController().signal,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.places[0]?.geocoded).toBeUndefined();
  });

  it("returns immediately when the run is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await geocodePlan(
      plan([place({ name: "Unique Museum 23" })]),
      "Lisbon, Portugal",
      controller.signal,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.places[0]?.lat).toBeNull();
  });
});
