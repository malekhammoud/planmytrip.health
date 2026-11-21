/**
 * Upstream TinyFish event mapping tests.
 *
 * Covers status, streaming URL schemes, provenance, completion, and malformed results.
 */

import { describe, expect, it } from "vitest";
import { WORKER_SOURCES } from "./swarmGoals";
import type { WorkerId } from "./swarmTypes";
import { parseTinyfishEvent } from "./tinyfish";
import { mapTinyfishEvent } from "./tinyfishEvents";

const NOW = "2026-11-21T12:00:00.000Z";

function mapFixture(fixture: unknown, worker: WorkerId = "advisory") {
  const parsed = parseTinyfishEvent(JSON.stringify(fixture));
  if (parsed === null) throw new Error("fixture should parse as a TinyFish event");
  return mapTinyfishEvent(parsed, { worker, now: () => NOW });
}

describe("mapTinyfishEvent", () => {
  it("maps STARTED to a running status with the worker and clock", () => {
    expect(
      mapFixture({ type: "STARTED", run_id: "run_1", timestamp: NOW }),
    ).toEqual({
      event: "worker_status",
      data: { worker: "advisory", ts: NOW, status: "running" },
    });
  });

  it("maps STREAMING_URL and PROGRESS payloads", () => {
    expect(
      mapFixture({
        type: "STREAMING_URL",
        run_id: "run_1",
        streaming_url: "https://preview.invalid/abc",
        timestamp: NOW,
      }),
    ).toEqual({
      event: "streaming_url",
      data: {
        worker: "advisory",
        ts: NOW,
        streamingUrl: "https://preview.invalid/abc",
      },
    });
    expect(
      mapFixture({
        type: "PROGRESS",
        run_id: "run_1",
        purpose: "Checking notices",
        timestamp: NOW,
      }),
    ).toEqual({
      event: "worker_progress",
      data: { worker: "advisory", ts: NOW, purpose: "Checking notices" },
    });
  });

  it("drops unsafe or relative streaming URLs", () => {
    for (const streamingUrl of [
      "javascript:alert(1)",
      "data:text/html,hello",
      "/preview/run_1",
      "ftp://preview.invalid/run_1",
      `https://preview.invalid/${"x".repeat(3_000)}`,
    ]) {
      expect(
        mapFixture({ type: "STREAMING_URL", run_id: "run_1", streaming_url: streamingUrl }),
      ).toBeNull();
    }
    expect(
      mapFixture({
        type: "STREAMING_URL",
        run_id: "run_1",
        streaming_url: "  https://preview.invalid/run_1  ",
        timestamp: NOW,
      }),
    ).toEqual({
      event: "streaming_url",
      data: {
        worker: "advisory",
        ts: NOW,
        streamingUrl: "https://preview.invalid/run_1",
      },
    });
  });

  it("ignores heartbeats, TF_API_RESULT, and unknown types", () => {
    expect(mapFixture({ type: "HEARTBEAT", timestamp: NOW })).toBeNull();
    expect(mapFixture({ type: "TF_API_RESULT", result: {} })).toBeNull();
    expect(parseTinyfishEvent(JSON.stringify({ type: "FUTURE_EVENT" }))).toBeNull();
  });

  it("maps a completed object result into typed findings with provenance", () => {
    const result = {
      destinationRiskLevel: "Exercise a high degree of caution",
      riskSummary: "Avoid protests.",
      healthNotices: ["Measles outbreak reported."],
      environmentalHazards: ["Poor air quality in summer."],
      sourceUrl: WORKER_SOURCES.advisory,
    };
    const event = mapFixture({
      type: "COMPLETE",
      run_id: "run_1",
      status: "COMPLETED",
      result,
      timestamp: NOW,
    });
    if (event === null || event.event !== "worker_complete") {
      throw new Error("expected worker_complete");
    }
    expect(event.data).toEqual({
      worker: "advisory",
      ts: NOW,
      findings: {
        destinationRiskLevel: result.destinationRiskLevel,
        riskSummary: result.riskSummary,
        healthNotices: result.healthNotices,
        environmentalHazards: result.environmentalHazards,
      },
      sourceUrl: WORKER_SOURCES.advisory,
      retrievedAt: NOW,
    });
  });

  it("parses a stringified result before normalising it", () => {
    const event = mapFixture({
      type: "COMPLETE",
      run_id: "run_1",
      status: "COMPLETED",
      result: JSON.stringify({
        genericName: "albuterol",
        localBrandNames: ["Ventolin"],
        customsRules: null,
        carryRules: "Carry a copy of the prescription.",
        sourceUrl: WORKER_SOURCES.pharmacy,
      }),
    }, "pharmacy");
    if (event === null || event.event !== "worker_complete") {
      throw new Error("expected worker_complete");
    }
    expect(event.data.findings).toEqual({
      genericName: "albuterol",
      localBrandNames: ["Ventolin"],
      customsRules: null,
      carryRules: "Carry a copy of the prescription.",
    });
  });

  it("keeps malformed result text and a parse error with null findings", () => {
    const event = mapFixture({
      type: "COMPLETE",
      run_id: "run_1",
      status: "COMPLETED",
      result: "the agent wrote prose instead of JSON",
    });
    if (event === null || event.event !== "worker_complete") {
      throw new Error("expected worker_complete");
    }
    expect(event.data.rawResult).toBe("the agent wrote prose instead of JSON");
    expect(event.data.parseError).toMatch(/not valid JSON/);
    expect(event.data.findings).toEqual({
      destinationRiskLevel: null,
      riskSummary: null,
      healthNotices: [],
      environmentalHazards: [],
    });
  });

  it("turns FAILED and CANCELLED into upstream_error", () => {
    for (const status of ["FAILED", "CANCELLED"]) {
      const event = mapFixture({
        type: "COMPLETE",
        run_id: "run_1",
        status,
        help_message: "Blocked by the site",
      });
      if (event === null || event.event !== "worker_error") {
        throw new Error("expected worker_error");
      }
      expect(event.data.code).toBe("upstream_error");
      expect(event.data.message.length).toBeGreaterThan(0);
      expect(event.data.message.endsWith(".")).toBe(true);
    }
  });

  it("normalises missing, placeholder, and duplicate values", () => {
    const event = mapFixture({
      type: "COMPLETE",
      status: "COMPLETED",
      result: {
        destinationRiskLevel: "Not found",
        riskSummary: "   ",
        healthNotices: ["One", "One", "", 7],
        environmentalHazards: null,
        sourceUrl: "ftp://not-a-page",
      },
    });
    if (event === null || event.event !== "worker_complete") {
      throw new Error("expected worker_complete");
    }
    expect(event.data.findings).toEqual({
      destinationRiskLevel: null,
      riskSummary: null,
      healthNotices: ["One"],
      environmentalHazards: [],
    });
    expect(event.data.sourceUrl).toBe(WORKER_SOURCES.advisory);
  });

  it("bounds long progress copy and malformed raw results", () => {
    const progress = mapFixture({
      type: "PROGRESS",
      purpose: "p".repeat(5_000),
    });
    if (progress === null || progress.event !== "worker_progress") {
      throw new Error("expected worker_progress");
    }
    expect(progress.data.purpose.length).toBeLessThanOrEqual(200);
    expect(progress.data.purpose.endsWith("…")).toBe(true);

    const raw = mapFixture({
      type: "COMPLETE",
      status: "COMPLETED",
      result: "r".repeat(5_000),
    });
    if (raw === null || raw.event !== "worker_complete") {
      throw new Error("expected worker_complete");
    }
    expect(raw.data.rawResult?.length).toBeLessThanOrEqual(2_000);
    expect(raw.data.rawResult?.endsWith("…")).toBe(true);
  });

  it("tags coverage checklist items as page or inferred, never guessing page", () => {
    const event = mapFixture({
      type: "COMPLETE",
      status: "COMPLETED",
      result: {
        emergencyMedicalLimit: "Mock limit",
        preAuthorizationRules: null,
        checklist: [
          { item: "Carry your policy card.", source: "page" },
          { item: "Call before non-emergency care.", source: "guessed" },
          { item: "   ", source: "page" },
          { item: "Unknown tag", source: null },
        ],
        sourceUrl: WORKER_SOURCES.coverage,
      },
    }, "coverage");
    if (event === null || event.event !== "worker_complete") {
      throw new Error("expected worker_complete");
    }
    expect(event.data.findings).toEqual({
      emergencyMedicalLimit: "Mock limit",
      preAuthorizationRules: null,
      checklist: [
        { item: "Carry your policy card.", source: "page" },
        { item: "Call before non-emergency care.", source: "inferred" },
        { item: "Unknown tag", source: "inferred" },
      ],
    });
  });
});
