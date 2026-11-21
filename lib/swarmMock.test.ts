/**
 * Mock timeline tests. No timers are faked: speed 100000 collapses the scripted clock
 * while preserving the event order and payloads.
 */

import { describe, expect, it } from "vitest";
import { createMockTimeline, runMockWorker, type MockRunOptions } from "@/lib/swarmMock";
import type { SwarmEvent } from "@/lib/swarmTypes";

const input = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory" as const,
  medication: "albuterol inhaler",
};

const options: MockRunOptions = { speed: 100_000, failWorker: null };

describe("createMockTimeline", () => {
  it("is deterministic and stays inside the documented bounds", () => {
    const first = createMockTimeline("coverage", input, { speed: 1, failWorker: null });
    const second = createMockTimeline("coverage", input, { speed: 1, failWorker: null });
    expect(second).toEqual(first);
    const progress = first.filter((entry) => entry.kind === "progress");
    const sources = first.filter((entry) => entry.kind === "sources");
    expect(progress.length).toBeGreaterThanOrEqual(12);
    expect(progress.length).toBeLessThanOrEqual(20);
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources.length).toBeLessThanOrEqual(3);
    expect(first[first.length - 1]?.kind).toBe("complete");
    expect(first.some((entry) => entry.kind === "heartbeat")).toBe(true);
    expect(new Set(progress.map((entry) => entry.purpose)).size).toBeGreaterThan(4);
  });

  it("moves the failure before completion for the named worker", () => {
    const failed = createMockTimeline("coverage", input, {
      speed: 1,
      failWorker: "coverage",
    });
    expect(failed.some((entry) => entry.kind === "fail")).toBe(true);
    expect(failed.some((entry) => entry.kind === "complete")).toBe(false);
    const healthy = createMockTimeline("advisory", input, {
      speed: 1,
      failWorker: "coverage",
    });
    expect(healthy.some((entry) => entry.kind === "complete")).toBe(true);
  });
});

describe("runMockWorker", () => {
  it("emits a monotonic mock lifecycle ending in typed findings", async () => {
    const events: SwarmEvent[] = [];
    let counter = 0;
    const outcome = await runMockWorker("advisory", input, (event) => events.push(event), () => {
      counter += 1;
      return counter;
    }, options);

    expect(outcome).toEqual({ worker: "advisory", ok: true });
    expect(events[0]?.event).toBe("worker_started");
    expect(events[1]?.event).toBe("streaming_url");
    expect(events.every((event) => event.data.mock === true)).toBe(true);
    expect(events[events.length - 1]?.event).toBe("worker_complete");
    const seq = events.map((event) => event.data.seq);
    expect(seq).toEqual(events.map((_, index) => index + 1));
    const complete = events[events.length - 1];
    if (complete?.event !== "worker_complete") throw new Error("expected completion");
    const findings = complete.data.findings as { destinationRiskLevel: string | null };
    expect(findings.destinationRiskLevel).toContain("caution");
    expect(events.filter((event) => event.event === "worker_sources").length).toBeGreaterThan(1);
  });

  it("fails the named worker with site_blocked after real progress", async () => {
    const events: SwarmEvent[] = [];
    let counter = 0;
    const outcome = await runMockWorker("coverage", input, (event) => events.push(event), () => {
      counter += 1;
      return counter;
    }, { speed: 100_000, failWorker: "coverage" });

    expect(outcome).toEqual({ worker: "coverage", ok: false });
    expect(events.filter((event) => event.event === "worker_progress").length).toBeGreaterThan(0);
    const error = events.find((event) => event.event === "worker_error");
    if (error?.event !== "worker_error") throw new Error("expected worker_error");
    expect(error.data.code).toBe("site_blocked");
  });
});
