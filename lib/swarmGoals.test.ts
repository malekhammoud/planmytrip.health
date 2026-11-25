/**
 * Worker schema, goal, and placeholder-normalisation tests.
 *
 * Uses the pure builders and normalisers only; no network.
 */

import { describe, expect, it } from "vitest";
import {
  WORKER_SCHEMAS,
  WORKER_SOURCES,
  buildWorkerGoal,
  normalizeAdvisoryResult,
  normalizeWorkerResult,
  type SwarmGoalInput,
} from "./swarmGoals";
import { WORKER_IDS } from "./swarmTypes";

const INPUT: SwarmGoalInput = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory",
};

function walk(value: unknown, visit: (key: string, child: unknown) => void): void {
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visit);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    visit(key, child);
    walk(child, visit);
  }
}

describe("worker output schemas", () => {
  it("use the documented structured-output subset for every worker", () => {
    for (const worker of WORKER_IDS) {
      const schema = WORKER_SCHEMAS[worker];
      expect(schema.type).toBe("object");
      const keys: string[] = [];
      const types: unknown[] = [];
      let nullable = 0;
      walk(schema, (key, child) => {
        keys.push(key);
        if (key === "type") types.push(child);
        if (key === "nullable" && child === true) nullable += 1;
      });
      expect(keys).not.toContain("oneOf");
      expect(keys).not.toContain("const");
      expect(keys).not.toContain("additionalProperties");
      expect(types.every((type) => !Array.isArray(type))).toBe(true);
      expect(nullable).toBeGreaterThan(0);
      expect(schema.properties.sourceUrl).toEqual({ type: "string", nullable: true });
    }
  });

  it("falls back to the canonical worker source when sourceUrl is missing or null", () => {
    for (const worker of WORKER_IDS) {
      for (const value of [{}, { sourceUrl: null }, { sourceUrl: "   " }]) {
        expect(normalizeWorkerResult(worker, value, WORKER_SOURCES[worker])).toMatchObject({
          sourceUrl: WORKER_SOURCES[worker],
        });
      }
    }
  });

  it("state the exact schema and the no-guess rule in every goal", () => {
    for (const worker of WORKER_IDS) {
      const goal = buildWorkerGoal(worker, INPUT);
      expect(goal).toContain(JSON.stringify(WORKER_SCHEMAS[worker], null, 2));
      expect(goal).toContain("Return only JSON");
      expect(goal).toContain("Never guess");
      expect(goal).toContain("null");
      expect(goal).toContain("[]");
      expect(goal).toContain("sourceUrl");
      expect(goal).toContain("Lisbon, Portugal");
      expect(goal).toContain("asthma or breathing conditions");
    }
  });

  it("asks only for the destination advisory", () => {
    const goal = buildWorkerGoal("advisory", INPUT);
    expect(goal).toContain("travel.gc.ca/travelling/advisories");
    expect(goal).toContain("risk level");
    expect(goal).toContain("health notices");
    expect(goal).toContain("environmental hazards");
    expect(goal).not.toContain("medication");
    expect(goal).not.toContain("insurance");
    expect(goal).not.toContain("pharmacy");
    expect(goal).not.toContain("Sun Life");
  });
});

describe("placeholder normalisation", () => {
  it("treats case, punctuation, and whitespace variants as missing", () => {
    const result = normalizeAdvisoryResult(
      {
        destinationRiskLevel: "Not found.",
        riskSummary: "UNKNOWN",
        healthNotices: ["Not specified", "N/A.", "not available.", "null", "Keep this notice."],
        environmentalHazards: ["Unknown", "Heat."],
      },
      WORKER_SOURCES.advisory,
    );
    expect(result.destinationRiskLevel).toBeNull();
    expect(result.riskSummary).toBeNull();
    expect(result.healthNotices).toEqual(["Keep this notice."]);
    expect(result.environmentalHazards).toEqual(["Heat."]);
  });

  it("keeps meaningful values even when they end with punctuation", () => {
    const result = normalizeAdvisoryResult(
      {
        destinationRiskLevel: " Exercise a high degree of caution. ",
        healthNotices: ["Measles notice.", "Not specified"],
        environmentalHazards: ["Not available."],
      },
      WORKER_SOURCES.advisory,
    );
    expect(result.destinationRiskLevel).toBe("Exercise a high degree of caution.");
    expect(result.healthNotices).toEqual(["Measles notice."]);
    expect(result.environmentalHazards).toEqual([]);
  });

  it("bounds untrusted text, lists, and source URLs", () => {
    const long = "x".repeat(20_000);
    const advisory = normalizeAdvisoryResult(
      {
        destinationRiskLevel: long,
        riskSummary: long,
        healthNotices: Array.from({ length: 50 }, (_, index) => `Notice ${index}`),
        environmentalHazards: [long],
        sourceUrl: `https://example.com/${"x".repeat(2_000)}`,
      },
      WORKER_SOURCES.advisory,
    );
    expect(advisory.destinationRiskLevel?.length).toBeLessThanOrEqual(1_200);
    expect(advisory.destinationRiskLevel?.endsWith("…")).toBe(true);
    expect(advisory.riskSummary?.length).toBeLessThanOrEqual(1_200);
    expect(advisory.healthNotices).toHaveLength(12);
    expect(advisory.environmentalHazards[0]?.length).toBeLessThanOrEqual(1_200);
    expect(advisory.sourceUrl).toBe(WORKER_SOURCES.advisory);
  });
});
