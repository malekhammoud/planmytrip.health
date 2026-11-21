/**
 * Frame validation contract: only allowlisted https preview URLs become reducer
 * actions, and frames from a superseded request are ignored.
 */

import { describe, expect, it } from "vitest";
import { applyFrame } from "@/hooks/swarmFrames";
import type { SwarmAction } from "@/lib/swarmReducer";
import type { SseMessage } from "@/lib/sse";
import type { WorkerId } from "@/lib/swarmTypes";

const LATEST: Record<WorkerId, number> = { advisory: 1, pharmacy: 1, coverage: 1 };

function frame(event: string, data: unknown): SseMessage {
  return { event, data: JSON.stringify(data) };
}

function collect(message: SseMessage, requestId = 1): SwarmAction[] {
  const actions: SwarmAction[] = [];
  applyFrame(
    message,
    (action) => {
      actions.push(action);
    },
    requestId,
    LATEST,
  );
  return actions;
}

describe("swarmFrames", () => {
  it("dispatches allowlisted https preview URLs", () => {
    for (const streamingUrl of [
      "https://mock.invalid/stream/advisory",
      "https://preview-abc123.unikraft.app/session/1",
      "https://ip-13-56-19-124.tetra-data.production.tinyfish.io/tf-abc/stream/0",
    ]) {
      const actions = collect(
        frame("streaming_url", { worker: "advisory", streamingUrl }),
      );
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        type: "streaming_url",
        worker: "advisory",
        streamingUrl,
      });
    }
  });

  it("drops http, app-origin, javascript, data, and unknown hosts", () => {
    for (const streamingUrl of [
      "http://preview-abc123.unikraft.app/session/1",
      "https://planmytrip.health/stream/advisory",
      "https://example.com/stream/advisory",
      "https://evilunikraft.app/stream/advisory",
      "https://eviltinyfish.io/stream/advisory",
      "https://sub.mock.invalid/stream/advisory",
      "https://unikraft.app/stream/advisory",
      "javascript:alert(1)",
      "data:text/html,<p>preview</p>",
    ]) {
      expect(
        collect(frame("streaming_url", { worker: "advisory", streamingUrl })),
      ).toEqual([]);
    }
  });

  it("ignores a frame superseded by a newer request", () => {
    const message = frame("streaming_url", {
      worker: "advisory",
      streamingUrl: "https://mock.invalid/stream/advisory",
    });
    expect(collect(message, 2)).toEqual([]);
  });
});
