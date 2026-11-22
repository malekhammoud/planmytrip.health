import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TinyfishEvent } from "@/lib/tinyfish";
import type { VenueEvent } from "./types";

const state = vi.hoisted(() => ({ calls: 0, failBooking: false }));

vi.mock("@/lib/tinyfish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tinyfish")>();
  return {
    ...actual,
    streamTinyfishRun: async (options: {
      url: string;
      onEvent: (event: TinyfishEvent) => void;
    }) => {
      state.calls += 1;
      if (state.failBooking && options.url.includes("booking")) {
        throw new Error("stream interrupted");
      }
      options.onEvent({ type: "STARTED", runId: "run-venue", timestamp: null });
      const hotel = options.url.includes("hotel");
      options.onEvent({
        type: "COMPLETE",
        runId: "run-venue",
        timestamp: null,
        status: "COMPLETED",
        result: hotel
          ? {
              hotelName: "The Hotel",
              sourceUrl: options.url,
              roomType: "King",
              nightlyRate: 189,
              total: 756,
              taxesAndFees: 80,
              currency: "CAD",
              cancellation: "Free until 48 hours before",
              bookingUrl: options.url,
              notes: [],
            }
          : {
              restaurantName: "The Cafe",
              sourceUrl: options.url,
              currency: "CAD",
              items: [
                {
                  section: "Mains",
                  name: "Soup",
                  description: "Daily soup.",
                  price: 12,
                  currency: "CAD",
                  allergenNotes: null,
                },
              ],
              notes: [],
            },
        error: null,
        helpUrl: null,
        helpMessage: null,
      });
    },
  };
});

vi.mock("@/lib/tinyfishRuns", () => ({
  fetchTinyfishRun: vi.fn().mockResolvedValue(null),
}));

import { resetCacheMemory } from "@/lib/cache/cacheStore";
import { runVenueResearch } from "./runner";
import type { VenueResearchRequest } from "./types";

const previousMemory = process.env.PLANMYTRIP_CACHE_MEMORY;
const previousDatabase = process.env.DATABASE_URL;

const request: VenueResearchRequest = {
  destination: "London, Ontario",
  checkIn: "2026-12-10",
  days: 4,
  travelers: 2,
  places: [
    {
      id: "place-hotel",
      name: "The Hotel",
      category: "stay",
      sourceUrl: "https://example.com/hotel",
    },
    {
      id: "place-cafe",
      name: "The Cafe",
      category: "eat",
      sourceUrl: "https://example.com/menu",
    },
  ],
};

describe("runVenueResearch", () => {
  beforeAll(() => {
    process.env.PLANMYTRIP_CACHE_MEMORY = "1";
    delete process.env.DATABASE_URL;
  });
  afterAll(() => {
    if (previousMemory === undefined) delete process.env.PLANMYTRIP_CACHE_MEMORY;
    else process.env.PLANMYTRIP_CACHE_MEMORY = previousMemory;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
  });
  beforeEach(() => {
    resetCacheMemory();
    state.calls = 0;
    state.failBooking = false;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns dated hotel evidence and menu evidence", async () => {
    const evidence = await runVenueResearch(
      request,
      "test-key",
      new AbortController().signal,
    );
    expect(evidence).toHaveLength(2);
    const hotel = evidence.find((item) => item.kind === "hotel");
    const menu = evidence.find((item) => item.kind === "menu");
    expect(hotel).toMatchObject({ checkIn: "2026-12-10", checkOut: "2026-12-14", nightlyRate: 189 });
    expect(menu).toMatchObject({
      items: [{ name: "Soup", price: 12 }],
    });
    expect(state.calls).toBe(2);

    const events: VenueEvent[] = [];
    const second = await runVenueResearch(
      request,
      "test-key",
      new AbortController().signal,
      (event) => events.push(event),
    );
    expect(second).toHaveLength(2);
    expect(state.calls).toBe(2);

    const cachedStatuses = events.filter(
      (event) => event.event === "venue_status" && event.data.cached === true,
    );
    expect(cachedStatuses).toHaveLength(2);
    const cachedSources = events.filter(
      (event) => event.event === "venue_sources" && event.data.cached === true,
    );
    expect(cachedSources.length).toBeGreaterThanOrEqual(2);
    expect(
      events.some(
        (event) =>
          event.event === "venue_activity" &&
          event.data.cached === true &&
          event.data.offsetSec !== undefined,
      ),
    ).toBe(true);
    const cachedResults = events.filter(
      (event) => event.event === "venue_result" && event.data.cached === true,
    );
    expect(cachedResults).toHaveLength(2);
    expect(events.at(-1)?.event).toBe("venue_done");
    expect(events.at(-1)).toMatchObject({ data: { cached: true } });
  });

  it("falls back to the plan source page when the booking page fails", async () => {
    state.failBooking = true;
    const events: VenueEvent[] = [];
    const evidence = await runVenueResearch(
      {
        ...request,
        places: [
          {
            id: "place-hotel",
            name: "The Hotel",
            category: "stay",
            sourceUrl: "https://example.com/hotel-source",
            bookingUrl: "https://example.com/booking-engine",
          },
        ],
      },
      "test-key",
      new AbortController().signal,
      (event) => events.push(event),
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.kind).toBe("hotel");
    expect(state.calls).toBe(2);
    expect(
      events.some(
        (event) =>
          event.event === "venue_activity" &&
          event.data.text.includes("preferred page did not answer"),
      ),
    ).toBe(true);
  });

  it("skips hotel jobs without a start date but still checks menus", async () => {
    const evidence = await runVenueResearch(
      { ...request, checkIn: "" },
      "test-key",
      new AbortController().signal,
    );
    expect(evidence.map((item) => item.kind)).toEqual(["menu"]);
  });

  it("returns an empty list without an API key", async () => {
    expect(
      await runVenueResearch(request, "", new AbortController().signal),
    ).toEqual([]);
    expect(state.calls).toBe(0);
  });
});
