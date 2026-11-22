import { describe, expect, it } from "vitest";
import { createVenueState, venueEvidence, venueReducer } from "./venueState";
import type { VenueWorkerMeta } from "./types";

const meta: VenueWorkerMeta = {
  id: "place-1",
  name: "The Cafe",
  category: "eat",
  kind: "menu",
  sourceUrl: "https://example.com/menu",
};

const evidence = {
  kind: "menu" as const,
  placeId: "place-1",
  placeName: "The Cafe",
  sourceUrl: "https://example.com/menu",
  retrievedAt: "2026-11-22T10:00:00.000Z",
  currency: "CAD",
  items: [],
  notes: [],
};

describe("venueReducer", () => {
  it("tracks one worker from queued to checked", () => {
    let state = venueReducer(createVenueState(), { type: "run_started" });
    state = venueReducer(state, { type: "venue_started", workers: [meta] });
    expect(state.workers["place-1"]?.phase).toBe("queued");
    state = venueReducer(state, { type: "venue_status", worker: "place-1", phase: "running", message: "Opening" });
    state = venueReducer(state, { type: "venue_activity", worker: "place-1", text: "Read the menu" });
    state = venueReducer(state, { type: "venue_sources", worker: "place-1", items: [{ url: "https://example.com/menu", api: "fetch" }] });
    state = venueReducer(state, { type: "venue_result", worker: "place-1", evidence });
    state = venueReducer(state, { type: "venue_done", done: { workers: 1, menus: 1, hotels: 0, items: 0, sources: 1 } });
    expect(state.workers["place-1"]?.phase).toBe("complete");
    expect(state.workers["place-1"]?.steps).toBe(1);
    expect(state.done?.sources).toBe(1);
    expect(venueEvidence(state)).toEqual([evidence]);
  });

  it("keeps evidence when the stream ends", () => {
    let state = venueReducer(createVenueState(), { type: "run_started" });
    state = venueReducer(state, { type: "venue_started", workers: [meta] });
    state = venueReducer(state, { type: "venue_result", worker: "place-1", evidence, cached: true });
    state = venueReducer(state, { type: "venue_done", done: { workers: 1, menus: 1, hotels: 0, items: 0, sources: 0 } });
    expect(venueEvidence(state)).toHaveLength(1);
    expect(state.workers["place-1"]?.cached).toBe(true);
  });
});
