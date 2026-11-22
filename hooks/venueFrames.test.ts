import { describe, expect, it } from "vitest";
import { applyVenueFrame } from "./venueFrames";
import { createVenueState, venueReducer, type VenueAction } from "@/lib/venue/venueState";
import type { SseMessage } from "@/lib/sse";

function apply(dispatch: (action: VenueAction) => void, message: SseMessage): boolean {
  return applyVenueFrame(message, dispatch);
}

describe("venue SSE frames", () => {
  it("accepts a worker roster and an allowlisted preview", () => {
    const actions: VenueAction[] = [];
    const dispatch = (action: VenueAction) => actions.push(action);
    expect(
      apply(dispatch, {
        event: "venue_started",
        data: JSON.stringify({
          workers: [
            {
              id: "place-1",
              name: "The Cafe",
              category: "eat",
              kind: "menu",
              sourceUrl: "https://example.com/menu",
            },
          ],
          ts: "2026-11-22T10:00:00.000Z",
        }),
      }),
    ).toBe(false);
    expect(
      apply(dispatch, {
        event: "venue_streaming_url",
        data: JSON.stringify({
          worker: "place-1",
          seq: 2,
          ts: "2026-11-22T10:00:01.000Z",
          streamingUrl: "https://run.tinyfish.io/stream/1",
        }),
      }),
    ).toBe(false);
    expect(actions.at(-1)?.type).toBe("venue_streaming_url");
  });

  it("drops a non-allowlisted preview URL and malformed evidence", () => {
    const actions: VenueAction[] = [];
    const dispatch = (action: VenueAction) => actions.push(action);
    apply(dispatch, {
      event: "venue_streaming_url",
      data: JSON.stringify({
        worker: "place-1",
        streamingUrl: "javascript:alert(1)",
      }),
    });
    apply(dispatch, {
      event: "venue_result",
      data: JSON.stringify({ worker: "place-1", evidence: { kind: "menu" } }),
    });
    expect(actions).toEqual([]);
  });

  it("returns true only for venue_done", () => {
    const state = venueReducer(createVenueState(), { type: "run_started" });
    const actions: VenueAction[] = [];
    const dispatch = (action: VenueAction) => {
      actions.push(action);
      venueReducer(state, action);
    };
    expect(
      apply(dispatch, {
        event: "venue_done",
        data: JSON.stringify({
          ts: "2026-11-22T10:00:00.000Z",
          completed: [],
          failed: [],
          summary: { workers: 0, menus: 0, hotels: 0, items: 0, sources: 0 },
        }),
      }),
    ).toBe(true);
  });
});
