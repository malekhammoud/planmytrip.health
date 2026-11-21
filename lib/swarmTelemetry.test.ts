/**
 * Live telemetry model tests: derivations, caps, duplicates, and out-of-order frames.
 */

import { describe, expect, it } from "vitest";
import {
  collectSources,
  connectionHealth,
  elapsedMs,
  isStale,
  isSwarmLive,
  mergedFeed,
  swarmSummary,
  tempoBuckets,
  QUIET_AFTER_MS,
  STALLED_AFTER_MS,
  type FeedLine,
} from "@/lib/swarmTelemetry";
import {
  createSwarmState,
  swarmReducer,
  type SwarmAction,
  type SwarmState,
} from "@/lib/swarmReducer";

const T0 = Date.parse("2026-11-21T12:00:00.000Z");
const iso = (offsetMs: number): string => new Date(T0 + offsetMs).toISOString();

function start(): SwarmState {
  return swarmReducer(createSwarmState(), {
    type: "run_started",
    runToken: 1,
    workers: ["advisory", "pharmacy", "coverage"],
  });
}

function apply(state: SwarmState, actions: readonly SwarmAction[]): SwarmState {
  return actions.reduce(swarmReducer, state);
}

function worker(state: SwarmState, id: "advisory" | "pharmacy" | "coverage") {
  return state.workers[id];
}

describe("elapsedMs", () => {
  it("returns zero without a start and freezes at the terminal frame", () => {
    expect(elapsedMs(worker(start(), "advisory"), T0)).toBe(0);
    let state = apply(start(), [
      {
        type: "worker_started",
        worker: "advisory",
        runId: "run_1",
        startedAt: iso(0),
        seq: 1,
        ts: iso(0),
      },
      {
        type: "worker_progress",
        worker: "advisory",
        purpose: "Reading",
        seq: 2,
        ts: iso(4_000),
      },
      {
        type: "worker_complete",
        worker: "advisory",
        findings: {
          destinationRiskLevel: null,
          riskSummary: null,
          healthNotices: [],
          environmentalHazards: [],
        },
        sourceUrl: "https://travel.gc.ca/travelling/advisories",
        retrievedAt: iso(9_000),
        seq: 3,
        ts: iso(9_000),
      },
    ]);
    expect(elapsedMs(worker(state, "advisory"), T0 + 60_000)).toBe(9_000);
    state = apply(state, [
      { type: "worker_started", worker: "pharmacy", runId: "run_2", startedAt: iso(0), seq: 1, ts: iso(0) },
    ]);
    expect(elapsedMs(worker(state, "pharmacy"), T0 + 12_500)).toBe(12_500);
  });
});

describe("tempoBuckets", () => {
  it("returns no bars for empty input", () => {
    expect(tempoBuckets([])).toEqual([]);
  });

  it("buckets real steps and leaves gaps as zero bars", () => {
    const steps = [
      { seq: 1, t: 0, purpose: "one" },
      { seq: 2, t: 1_000, purpose: "two" },
      { seq: 3, t: 11_000, purpose: "three" },
    ];
    expect(tempoBuckets(steps, 5_000)).toEqual([2, 0, 1]);
  });

  it("ignores buckets beyond the display cap", () => {
    const steps = [{ seq: 1, t: 0, purpose: "one" }, { seq: 2, t: 999_999, purpose: "far" }];
    expect(tempoBuckets(steps, 1_000)).toEqual([1]);
  });
});

describe("connectionHealth", () => {
  it("classifies silence without inventing activity", () => {
    expect(connectionHealth(null, T0)).toBe("stalled");
    expect(connectionHealth(T0, T0 + 1_000)).toBe("live");
    expect(connectionHealth(T0, T0 + QUIET_AFTER_MS + 1)).toBe("quiet");
    expect(connectionHealth(T0, T0 + STALLED_AFTER_MS + 1)).toBe("stalled");
  });
});

describe("swarmSummary", () => {
  it("counts active workers, steps, sources, and findings", () => {
    let state = apply(start(), [
      { type: "worker_started", worker: "advisory", runId: "r", startedAt: iso(0), seq: 1, ts: iso(0) },
      { type: "worker_progress", worker: "advisory", purpose: "Reading", tinyfishApi: "search", seq: 2, ts: iso(1_000) },
      {
        type: "worker_sources",
        worker: "advisory",
        items: [{ url: "https://travel.gc.ca/a", title: "Advisory", api: "search" }],
        seq: 3,
        ts: iso(2_000),
      },
      {
        type: "worker_complete",
        worker: "advisory",
        findings: {
          destinationRiskLevel: null,
          riskSummary: null,
          healthNotices: [],
          environmentalHazards: [],
        },
        sourceUrl: "https://travel.gc.ca/a",
        retrievedAt: iso(3_000),
        seq: 4,
        ts: iso(3_000),
      },
      { type: "worker_error", worker: "pharmacy", code: "timeout", message: "Timed out.", seq: 1, ts: iso(3_000) },
    ]);
    expect(swarmSummary(state)).toEqual({
      running: 1,
      steps: 1,
      sources: 2,
      findings: 1,
      completed: 1,
      failed: 1,
    });
    expect(isSwarmLive(state)).toBe(true);
    state = apply(state, [
      { type: "worker_complete", worker: "coverage", findings: { emergencyMedicalLimit: null, preAuthorizationRules: null, checklist: [] }, sourceUrl: "https://sunlife.ca", retrievedAt: iso(4_000), seq: 1, ts: iso(4_000) },
    ]);
    expect(isSwarmLive(state)).toBe(false);
  });

  it("is all zeroes for a pristine state", () => {
    expect(swarmSummary(createSwarmState())).toEqual({
      running: 0,
      steps: 0,
      sources: 0,
      findings: 0,
      completed: 0,
      failed: 0,
    });
  });
});

describe("mergedFeed", () => {
  it("is empty before any activity", () => {
    expect(mergedFeed(createSwarmState())).toEqual([]);
  });

  it("orders by receive time, filters by worker, and never includes heartbeats", () => {
    const state = apply(start(), [
      { type: "worker_progress", worker: "pharmacy", purpose: "Pharmacy first", seq: 1, ts: iso(3_000) },
      { type: "worker_progress", worker: "advisory", purpose: "Advisory later", seq: 1, ts: iso(1_000) },
      { type: "worker_heartbeat", worker: "advisory", seq: 2, ts: iso(2_000) },
      { type: "worker_note", worker: "advisory", message: "Retrying with stealth.", seq: 3, ts: iso(5_000) },
    ]);
    const feed = mergedFeed(state);
    expect(feed.map((line) => line.text)).toEqual([
      "Advisory later",
      "Pharmacy first",
      "Retrying with stealth.",
    ]);
    expect(feed).toHaveLength(3);
    expect(mergedFeed(state, "pharmacy").map((line) => line.text)).toEqual(["Pharmacy first"]);
  });

  it("keeps only the newest cap lines", () => {
    const actions: SwarmAction[] = [];
    for (let index = 1; index <= 40; index += 1) {
      actions.push({
        type: "worker_progress",
        worker: "advisory",
        purpose: `Step ${index}`,
        seq: index,
        ts: iso(index * 1_000),
      });
    }
    const feed = mergedFeed(apply(start(), actions), "all", 5);
    expect(feed).toHaveLength(5);
    expect(feed[0]?.text).toBe("Step 36");
    expect(feed[4]?.text).toBe("Step 40");
  });
});

describe("collectSources", () => {
  it("merges source rows with search steps and deduplicates", () => {
    const state = apply(start(), [
      { type: "worker_progress", worker: "advisory", purpose: "Searching notices", tinyfishApi: "search", seq: 1, ts: iso(1_000) },
      { type: "worker_progress", worker: "advisory", purpose: "Searching notices", tinyfishApi: "search", seq: 2, ts: iso(2_000) },
      {
        type: "worker_sources",
        worker: "advisory",
        items: [{ url: "https://travel.gc.ca/a", title: "Advisory", api: "fetch" }],
        seq: 3,
        ts: iso(3_000),
      },
      {
        type: "worker_sources",
        worker: "advisory",
        items: [{ url: "https://travel.gc.ca/a", title: "Advisory again", api: "fetch" }],
        seq: 4,
        ts: iso(4_000),
      },
    ]);
    const sources = collectSources(worker(state, "advisory"));
    expect(sources).toHaveLength(2);
    expect(sources[0]?.url).toBe("https://travel.gc.ca/a");
    expect(sources[1]?.title).toBe("Searching notices");
  });
});

describe("reducer telemetry invariants", () => {
  it("ignores duplicate and out-of-order sequences", () => {
    let state = apply(start(), [
      { type: "worker_progress", worker: "advisory", purpose: "First", seq: 2, ts: iso(1_000) },
    ]);
    state = apply(state, [
      { type: "worker_progress", worker: "advisory", purpose: "Duplicate", seq: 2, ts: iso(2_000) },
      { type: "worker_progress", worker: "advisory", purpose: "Late", seq: 1, ts: iso(3_000) },
    ]);
    expect(worker(state, "advisory").steps.map((step) => step.purpose)).toEqual(["First"]);
    state = apply(state, [
      { type: "worker_progress", worker: "advisory", purpose: "Next", seq: 3, ts: iso(4_000) },
    ]);
    expect(worker(state, "advisory").stepCount).toBe(2);
  });

  it("caps steps, sources, and notes without losing the counters", () => {
    const actions: SwarmAction[] = [];
    for (let index = 1; index <= 250; index += 1) {
      actions.push({
        type: "worker_progress",
        worker: "advisory",
        purpose: `Step ${index}`,
        seq: index,
        ts: iso(index),
      });
    }
    for (let index = 1; index <= 120; index += 1) {
      actions.push({
        type: "worker_sources",
        worker: "advisory",
        items: [{ url: `https://travel.gc.ca/${index}`, api: "fetch" }],
        seq: 250 + index,
        ts: iso(300 + index),
      });
    }
    for (let index = 1; index <= 25; index += 1) {
      actions.push({
        type: "worker_note",
        worker: "advisory",
        message: `Note ${index}`,
        seq: 500 + index,
        ts: iso(500 + index),
      });
    }
    const state = apply(start(), actions);
    const advisory = worker(state, "advisory");
    expect(advisory.stepCount).toBe(250);
    expect(advisory.steps).toHaveLength(200);
    expect(advisory.sources).toHaveLength(100);
    expect(advisory.notes).toHaveLength(20);
    expect(advisory.retries).toBe(25);
  });

  it("tracks heartbeat count and last receive time", () => {
    const state = apply(start(), [
      { type: "worker_status", worker: "advisory", status: "running", seq: 1, ts: iso(0) },
      { type: "worker_heartbeat", worker: "advisory", seq: 2, ts: iso(5_000) },
      { type: "worker_heartbeat", worker: "advisory", seq: 3, ts: iso(10_000) },
    ]);
    expect(worker(state, "advisory").heartbeat).toEqual({ count: 2, lastAt: T0 + 10_000 });
    expect(worker(state, "advisory").lastEventAt).toBe(T0 + 10_000);
  });
});

describe("isStale", () => {
  const run = { destination: "Lisbon, Portugal", condition: "asthma_respiratory" as const, medication: "albuterol" };
  it("compares the trimmed snapshot fields", () => {
    expect(isStale(null, run)).toBe(false);
    expect(isStale(run, run)).toBe(false);
    expect(isStale(run, { ...run, destination: "Porto, Portugal" })).toBe(true);
    expect(isStale(run, { ...run, condition: "cardiac_hypertension" })).toBe(true);
    expect(isStale(run, { ...run, medication: "ventolin" })).toBe(true);
    expect(isStale({ ...run, destination: " Lisbon, Portugal " }, run)).toBe(false);
  });
});

// Keep the type imported so a change to FeedLine breaks this file at compile time.
const feedLine: FeedLine | null = null;
void feedLine;
