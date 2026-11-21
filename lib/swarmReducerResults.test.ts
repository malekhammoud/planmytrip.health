/**
 * Swarm reducer result contract: the three-line progress cap, typed findings and
 * provenance, terminal errors, canonical swarm_done lists, and the mock flag.
 */

import { describe, expect, it } from "vitest";
import {
  PROGRESS_LIMIT,
  createSwarmState,
  swarmReducer,
  type SwarmState,
} from "@/lib/swarmReducer";
import { WORKER_IDS, type AdvisoryFindings, type WorkerId } from "@/lib/swarmTypes";

const ADVISORY_FINDINGS: AdvisoryFindings = {
  destinationRiskLevel: "Exercise a high degree of caution",
  riskSummary: "Read the current advisory before departure.",
  healthNotices: ["A health notice."],
  environmentalHazards: ["Heat and humidity."],
};

function started(
  runToken = 1,
  workers: readonly WorkerId[] = WORKER_IDS,
): SwarmState {
  return swarmReducer(createSwarmState(), {
    type: "run_started",
    runToken,
    workers,
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

describe("swarmReducer results", () => {
  it("keeps only the last three progress lines", () => {
    let state = started();
    for (const purpose of ["one", "two", "three", "four", "five"]) {
      state = swarmReducer(state, {
        type: "worker_progress",
        worker: "pharmacy",
        purpose,
      });
    }
    expect(state.workers.pharmacy.progress).toEqual(["three", "four", "five"]);
    expect(state.workers.pharmacy.progress).toHaveLength(PROGRESS_LIMIT);

    state = swarmReducer(state, {
      type: "worker_progress",
      worker: "pharmacy",
      purpose: "   ",
    });
    expect(state.workers.pharmacy.progress).toHaveLength(3);
  });

  it("stores typed findings and provenance on completion", () => {
    let state = started();
    state = swarmReducer(state, {
      type: "streaming_url",
      worker: "advisory",
      streamingUrl: "https://mock.invalid/stream/advisory",
    });
    state = completeAdvisory(state);

    const advisory = state.workers.advisory;
    expect(advisory.phase).toBe("complete");
    expect(advisory.findings).toEqual(ADVISORY_FINDINGS);
    expect(advisory.sourceUrl).toBe("https://travel.gc.ca/travelling/advisories");
    expect(advisory.retrievedAt).toBe("2026-11-21T04:29:00.000Z");
    expect(advisory.rawResult).toBe('{"destinationRiskLevel":"caution"}');
    expect(advisory.parseError).toBeNull();
    expect(advisory.streamingUrl).toBeNull();
  });

  it("records a failure and keeps both terminal states closed", () => {
    let state = started();
    state = swarmReducer(state, {
      type: "worker_error",
      worker: "coverage",
      message: "The agent did not finish within 110 seconds. Retry this check.",
      code: "timeout",
    });
    expect(state.workers.coverage).toMatchObject({
      phase: "error",
      errorCode: "timeout",
      errorMessage: "The agent did not finish within 110 seconds. Retry this check.",
      findings: null,
    });

    state = swarmReducer(state, {
      type: "worker_complete",
      worker: "coverage",
      findings: ADVISORY_FINDINGS,
      sourceUrl: "https://www.sunlife.ca/",
      retrievedAt: "2026-11-21T04:29:00.000Z",
    });
    expect(state.workers.coverage.phase).toBe("error");

    state = completeAdvisory(state);
    state = swarmReducer(state, {
      type: "worker_error",
      worker: "advisory",
      message: "A late error.",
    });
    expect(state.workers.advisory.phase).toBe("complete");
    expect(state.workers.advisory.findings).toEqual(ADVISORY_FINDINGS);
  });

  it("stores swarm_done in canonical worker order", () => {
    let state = started();
    state = swarmReducer(state, {
      type: "swarm_done",
      completed: ["coverage", "advisory"],
      failed: ["pharmacy"],
      mock: true,
    });
    expect(state.done).toEqual({
      completed: ["advisory", "coverage"],
      failed: ["pharmacy"],
    });
    expect(state.mock).toBe(true);
  });

  it("tracks mock payloads without overriding a new live run", () => {
    let state = started();
    state = swarmReducer(state, {
      type: "worker_status",
      worker: "advisory",
      status: "running",
      mock: true,
    });
    expect(state.mock).toBe(true);

    state = swarmReducer(state, {
      type: "run_started",
      runToken: 1,
      workers: ["coverage"],
    });
    expect(state.mock).toBe(true);

    state = swarmReducer(state, {
      type: "run_started",
      runToken: 2,
      workers: WORKER_IDS,
    });
    expect(state.mock).toBe(false);
  });
});
