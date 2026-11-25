/**
 * Swarm reducer transition and reset contract: idle/queued/running, the idle event gate,
 * allowlisted preview URLs, retry, and stream_failed scoping.
 */

import { describe, expect, it } from "vitest";
import {
  createQueuedSwarmState,
  createSwarmState,
  swarmReducer,
  type SwarmAction,
  type SwarmState,
} from "@/lib/swarmReducer";
import { WORKER_IDS, type AdvisoryFindings } from "@/lib/swarmTypes";

const ADVISORY_FINDINGS: AdvisoryFindings = {
  destinationRiskLevel: "Exercise a high degree of caution",
  riskSummary: "Read the current advisory before departure.",
  healthNotices: ["A health notice."],
  environmentalHazards: ["Heat and humidity."],
};

function started(runToken = 1): SwarmState {
  return swarmReducer(createSwarmState(), {
    type: "run_started",
    runToken,
    workers: WORKER_IDS,
  });
}

function completeAdvisory(state: SwarmState): SwarmState {
  return swarmReducer(state, {
    type: "worker_complete",
    worker: "advisory",
    findings: ADVISORY_FINDINGS,
    sourceUrl: "https://travel.gc.ca/travelling/advisories",
    retrievedAt: "2026-11-21T04:29:00.000Z",
    rawResult: '{"destinationRiskLevel":"caution"}',
  });
}

describe("swarmReducer transitions", () => {
  it("starts idle with no run, findings, or done list", () => {
    const state = createSwarmState();
    expect(state.runToken).toBe(0);
    expect(state.mock).toBe(false);
    expect(state.done).toBeNull();
    for (const worker of WORKER_IDS) {
      expect(state.workers[worker].phase).toBe("idle");
      expect(state.workers[worker].progress).toEqual([]);
      expect(state.workers[worker].findings).toBeNull();
    }
    expect(createQueuedSwarmState(4).workers.advisory.phase).toBe("queued");
  });

  it("resets the worker for a new run token", () => {
    let state = started();
    state = completeAdvisory(state);
    state = swarmReducer(state, {
      type: "swarm_done",
      completed: ["advisory"],
      failed: [],
    });

    state = swarmReducer(state, {
      type: "run_started",
      runToken: 2,
      workers: WORKER_IDS,
    });
    expect(state.runToken).toBe(2);
    expect(state.mock).toBe(false);
    expect(state.done).toBeNull();
    for (const worker of WORKER_IDS) {
      expect(state.workers[worker]).toMatchObject({
        phase: "queued",
        findings: null,
        sourceUrl: null,
        errorMessage: null,
        progress: [],
      });
    }
  });

  it("advances queued to running and ignores a stale regression", () => {
    let state = started();
    expect(state.workers.advisory.phase).toBe("queued");

    state = swarmReducer(state, {
      type: "worker_status",
      worker: "advisory",
      status: "running",
    });
    state = swarmReducer(state, {
      type: "worker_status",
      worker: "advisory",
      status: "queued",
    });
    expect(state.workers.advisory.phase).toBe("running");
  });

  it("accepts only allowlisted https preview URLs", () => {
    let state = started();
    const rejected = [
      "http://preview-abc123.unikraft.app/session/1",
      "https://live.tinyfish.ai/session/abc",
      "https://unikraft.app/session/1",
      "https://evilunikraft.app/session/1",
      "https://eviltinyfish.io/session/1",
      "https://sub.mock.invalid/stream/advisory",
      "https://planmytrip.health/stream/advisory",
      "javascript:alert(1)",
      "data:text/html,<p>preview</p>",
      "/mock-browser/pharmacy",
    ];
    for (const streamingUrl of rejected) {
      const next = swarmReducer(state, {
        type: "streaming_url",
        worker: "advisory",
        streamingUrl,
      });
      expect(next).toBe(state);
    }
    expect(state.workers.advisory.streamingUrl).toBeNull();

    for (const streamingUrl of [
      "https://preview-abc123.unikraft.app/session/1",
      "https://ip-13-56-19-124.tetra-data.production.tinyfish.io/tf-abc/stream/0",
      "https://mock.invalid/stream/advisory",
      "/mock-browser/advisory",
    ]) {
      state = swarmReducer(state, {
        type: "streaming_url",
        worker: "advisory",
        streamingUrl,
      });
      expect(state.workers.advisory.streamingUrl).toBe(streamingUrl);
    }
  });

  it("ignores every worker event while the worker is idle", () => {
    const initial = createSwarmState();
    const events: SwarmAction[] = [
      { type: "worker_status", worker: "advisory", status: "running" },
      {
        type: "streaming_url",
        worker: "advisory",
        streamingUrl: "/mock-browser/advisory",
      },
      { type: "worker_progress", worker: "advisory", purpose: "Reading" },
      {
        type: "worker_complete",
        worker: "advisory",
        findings: ADVISORY_FINDINGS,
        sourceUrl: "https://travel.gc.ca/travelling/advisories",
        retrievedAt: "2026-11-21T04:29:00.000Z",
      },
      { type: "worker_error", worker: "advisory", message: "Stopped." },
      { type: "stream_failed", message: "Broken.", workers: ["advisory"] },
    ];

    let state = initial;
    for (const event of events) {
      const next = swarmReducer(state, event);
      expect(next).toBe(state);
      state = next;
    }
    expect(state.workers.advisory.phase).toBe("idle");
    expect(state.workers.advisory.progress).toEqual([]);
    expect(state.workers.advisory.findings).toBeNull();
    expect(state.mock).toBe(false);
  });

  it("resets only the named worker on a retry", () => {
    let state = started();
    state = completeAdvisory(state);

    state = swarmReducer(state, {
      type: "run_started",
      runToken: 1,
      workers: ["advisory"],
    });
    expect(state.workers.advisory.phase).toBe("queued");
    expect(state.workers.advisory.errorMessage).toBeNull();
    expect(state.workers.advisory.findings).toBeNull();
    expect(state.done).toBeNull();
  });

  it("fails a pending worker when a stream breaks and leaves a completed one alone", () => {
    let state = started();
    state = swarmReducer(state, {
      type: "stream_failed",
      message: "The verification service could not be reached.",
      workers: ["advisory"],
    });
    expect(state.workers.advisory.phase).toBe("error");
    expect(state.workers.advisory.errorMessage).toBe(
      "The verification service could not be reached.",
    );
    expect(state.workers.advisory.errorCode).toBeNull();

    state = started();
    state = completeAdvisory(state);
    state = swarmReducer(state, {
      type: "stream_failed",
      message: "Too late.",
    });
    expect(state.workers.advisory.phase).toBe("complete");
  });
});
