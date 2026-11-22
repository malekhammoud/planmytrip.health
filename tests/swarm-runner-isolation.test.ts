import { afterEach, describe, expect, it, vi } from "vitest";
import type { TinyfishEvent } from "@/lib/tinyfish";

vi.mock("@/lib/tinyfish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tinyfish")>();
  return {
    ...actual,
    streamTinyfishRun: (options: {
      url: string;
      onEvent: (event: TinyfishEvent) => void;
    }) => {
      if (options.url.includes("travel.gc.ca")) throw new Error("unexpected failure");
      options.onEvent({ type: "STARTED", runId: "run-pharmacy", timestamp: null });
      options.onEvent({
        type: "COMPLETE",
        runId: "run-pharmacy",
        timestamp: null,
        status: "COMPLETED",
        result: {
          genericName: "albuterol (salbutamol)",
          localBrandNames: ["Ventolin"],
          customsRules: null,
          carryRules: null,
        },
        error: null,
        helpUrl: null,
        helpMessage: null,
      });
      return Promise.resolve();
    },
  };
});

import { runSwarm } from "@/lib/swarmRunner";
import type { SwarmEvent } from "@/lib/swarmTypes";

const input = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory" as const,
  medication: "albuterol inhaler",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runSwarm worker isolation", () => {
  it("keeps a sibling running when one worker throws unexpectedly", async () => {
    const events: SwarmEvent[] = [];
    await runSwarm(
      ["advisory", "pharmacy"],
      {
        input,
        apiKey: "test-key-not-real",
        emit: (event) => events.push(event),
        signal: new AbortController().signal,
      },
      false,
    );

    const errors = events.filter((event) => event.event === "worker_error");
    expect(errors.map((event) => event.data.worker)).toEqual(["advisory"]);
    expect(errors[0]?.data.code).toBe("upstream_error");

    const completes = events.filter((event) => event.event === "worker_complete");
    expect(completes.map((event) => event.data.worker)).toEqual(["pharmacy"]);

    const last = events[events.length - 1];
    if (last?.event !== "swarm_done") throw new Error("expected swarm_done last");
    expect(last.data.completed).toEqual(["pharmacy"]);
    expect(last.data.failed).toEqual(["advisory"]);
  });
});
