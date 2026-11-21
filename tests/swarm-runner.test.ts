import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/swarmGoals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/swarmGoals")>();
  return {
    ...actual,
    buildWorkerGoal: () => {
      throw new Error("goal builder failed");
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

describe("runSwarm rejection isolation", () => {
  it("turns a synchronous worker throw into one error each and a final swarm_done", async () => {
    const events: SwarmEvent[] = [];
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

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

    expect(fetchMock).not.toHaveBeenCalled();
    const errors = events.filter((event) => event.event === "worker_error");
    expect(errors).toHaveLength(2);
    expect(errors.map((event) => event.data.worker)).toEqual(["advisory", "pharmacy"]);
    expect(errors.every((event) => event.data.code === "upstream_error")).toBe(true);
    expect(events.filter((event) => event.event === "swarm_done")).toHaveLength(1);

    const last = events[events.length - 1];
    if (last?.event !== "swarm_done") throw new Error("expected swarm_done last");
    expect(last.data.completed).toEqual([]);
    expect(last.data.failed).toEqual(["advisory", "pharmacy"]);
  });
});
