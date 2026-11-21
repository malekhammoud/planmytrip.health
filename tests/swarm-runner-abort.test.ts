import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pharmacySignal: null as AbortSignal | null }));

vi.mock("@/lib/tinyfish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tinyfish")>();
  return {
    ...actual,
    streamTinyfishRun: (options: { url: string; signal?: AbortSignal }) => {
      if (options.url.includes("travel.gc.ca")) throw new Error("unexpected failure");
      if (options.signal) state.pharmacySignal = options.signal;
      return new Promise<void>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
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

describe("runSwarm sibling abort", () => {
  it("aborts a running sibling and emits one error per failed worker", async () => {
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
    expect(errors.map((event) => event.data.worker)).toEqual(["advisory", "pharmacy"]);
    expect(errors.every((event) => event.data.code === "upstream_error")).toBe(true);
    expect(state.pharmacySignal).not.toBeNull();
    expect(state.pharmacySignal?.aborted).toBe(true);

    const last = events[events.length - 1];
    if (last?.event !== "swarm_done") throw new Error("expected swarm_done last");
    expect(last.data.failed).toEqual(["advisory", "pharmacy"]);
  });
});
