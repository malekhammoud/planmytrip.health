import { afterEach, describe, expect, it, vi } from "vitest";
import type { TinyfishEvent } from "@/lib/tinyfish";

const state = vi.hoisted(() => ({ attempts: 0, alwaysEndEarly: false }));

vi.mock("@/lib/tinyfish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tinyfish")>();
  return {
    ...actual,
    streamTinyfishRun: (options: {
      onEvent: (event: TinyfishEvent) => void;
    }) => {
      state.attempts += 1;
      options.onEvent({ type: "STARTED", runId: "run-advisory", timestamp: null });
      if (state.alwaysEndEarly || state.attempts === 1) return Promise.resolve();
      options.onEvent({
        type: "COMPLETE",
        runId: "run-advisory",
        timestamp: null,
        status: "COMPLETED",
        result: {
          destinationRiskLevel: "low",
          riskSummary: "No advisory.",
          healthNotices: [],
          environmentalHazards: [],
        },
        error: null,
        helpUrl: null,
        helpMessage: null,
      });
      return Promise.resolve();
    },
  };
});

const runDetail = vi.hoisted(() => ({
  fetchTinyfishRun: vi.fn(),
}));

vi.mock("@/lib/tinyfishRuns", () => runDetail);

import { runSwarm } from "@/lib/swarmRunner";
import { SWARM_RETRY_NOTES } from "@/lib/swarmConfig";
import type { SwarmEvent } from "@/lib/swarmTypes";

const input = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory" as const,
  medication: "albuterol inhaler",
};

async function run(): Promise<SwarmEvent[]> {
  const events: SwarmEvent[] = [];
  await runSwarm(
    ["advisory"],
    {
      input,
      apiKey: "test-key-not-real",
      emit: (event) => events.push(event),
      signal: new AbortController().signal,
    },
    false,
  );
  return events;
}

afterEach(() => {
  vi.clearAllMocks();
  state.attempts = 0;
  state.alwaysEndEarly = false;
});

describe("TinyFish stream recovery", () => {
  it("recovers a completed run when the SSE stream ends early", async () => {
    runDetail.fetchTinyfishRun.mockResolvedValue({
      status: "COMPLETED",
      result: {
        destinationRiskLevel: "low",
        riskSummary: "Recovered from the run record.",
        healthNotices: [],
        environmentalHazards: [],
      },
    });
    const events = await run();
    expect(runDetail.fetchTinyfishRun).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.event === "worker_error")).toBe(false);
    const complete = events.find((event) => event.event === "worker_complete");
    expect(complete?.event).toBe("worker_complete");
    if (complete?.event === "worker_complete") {
      expect(complete.data.findings).toMatchObject({
        riskSummary: "Recovered from the run record.",
      });
    }
    const last = events[events.length - 1];
    expect(last?.event).toBe("swarm_done");
    if (last?.event === "swarm_done") {
      expect(last.data.completed).toEqual(["advisory"]);
    }
  });

  it("emits one final error after the retry also fails", async () => {
    state.alwaysEndEarly = true;
    runDetail.fetchTinyfishRun.mockResolvedValue({
      status: "FAILED",
      error: "UPSTREAM_ERROR",
    });
    const events = await run();
    expect(state.attempts).toBe(2);
    const errors = events.filter((event) => event.event === "worker_error");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.data.code).toBe("upstream_error");
    const last = events[events.length - 1];
    expect(last?.event).toBe("swarm_done");
    if (last?.event === "swarm_done") {
      expect(last.data.completed).toEqual([]);
      expect(last.data.failed).toEqual(["advisory"]);
    }
  });

  it("retries once after a recovered run failure, then completes", async () => {
    runDetail.fetchTinyfishRun.mockResolvedValue({
      status: "FAILED",
      error: "UPSTREAM_ERROR",
    });
    const events = await run();
    expect(state.attempts).toBe(2);
    const notes = events.filter((event) => event.event === "worker_note");
    expect(notes.some((event) => event.event === "worker_note" && event.data.message === SWARM_RETRY_NOTES.transient)).toBe(true);
    expect(events.some((event) => event.event === "worker_error")).toBe(false);
    const last = events[events.length - 1];
    expect(last?.event).toBe("swarm_done");
    if (last?.event === "swarm_done") {
      expect(last.data.completed).toEqual(["advisory"]);
      expect(last.data.failed).toEqual([]);
    }
  });
});
