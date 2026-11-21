/**
 * Worker schema, goal, placeholder-normalisation, and shared-rule tests.
 *
 * Uses the pure builders and normalisers only; no network.
 */

import { describe, expect, it } from "vitest";
import { SUN_LIFE_RULES } from "./sunLifeRules";
import * as swarmGoals from "./swarmGoals";
import { WORKER_IDS } from "./swarmTypes";
import {
  WORKER_SCHEMAS,
  WORKER_SOURCES,
  buildWorkerGoal,
  normalizeAdvisoryResult,
  normalizePharmacyResult,
  normalizeWorkerResult,
  type SwarmGoalInput,
} from "./swarmGoals";

const INPUT: SwarmGoalInput = {
  destination: "Lisbon, Portugal",
  condition: "asthma_respiratory",
  medication: "albuterol inhaler",
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
      expect(goal).toContain("albuterol inhaler");
      expect(goal).toContain("asthma or respiratory conditions");
    }
  });

  it("carries the coverage page and inferred source tags", () => {
    const goal = buildWorkerGoal("coverage", INPUT);
    expect(goal).toContain('"page"');
    expect(goal).toContain('"inferred"');
    expect(goal).toContain("not condition-specific");
  });

  it("uses the shared nested Sun Life rules and labels plan context as non-findings", () => {
    const goal = buildWorkerGoal("coverage", INPUT);
    expect(goal).toContain(`${SUN_LIFE_RULES.tripDayCap} days per trip`);
    expect(goal).toContain(SUN_LIFE_RULES.preAuthorization.provider);
    expect(goal).toContain(SUN_LIFE_RULES.preAuthorization.availability);
    expect(goal).toContain(SUN_LIFE_RULES.preAuthorization.note);
    expect(goal).toContain("Report only what the page states. The plan context is not a finding.");
    expect(goal).not.toContain("stability");
    expect(goal).not.toContain("not confirmed");
    expect(goal).not.toContain("null days");
  });
});

describe("SUN_LIFE_RULES", () => {
  it("comes only from the shared rules module", () => {
    expect("SUN_LIFE_RULES" in swarmGoals).toBe(false);
  });

  it("keeps the shared nested values and the unconfirmed stability window", () => {
    expect(SUN_LIFE_RULES.tripDayCap).toBe(60);
    expect(SUN_LIFE_RULES.preAuthorization.provider).toBe("Allianz Global Assistance");
    expect(SUN_LIFE_RULES.preAuthorization.availability).toBe("24/7");
    expect(SUN_LIFE_RULES.preAuthorization.required).toBe(true);
    expect(SUN_LIFE_RULES.stabilityWindow.days).toBeNull();
    expect(SUN_LIFE_RULES.stabilityWindow.isPlaceholder).toBe(true);
    expect(SUN_LIFE_RULES.administratorNotice).toBe("Verify with your plan administrator");
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
    const result = normalizePharmacyResult(
      {
        genericName: "  Albuterol.  ",
        localBrandNames: ["Ventolin.", "Not specified"],
        customsRules: "Not available.",
        carryRules: "Carry a copy.",
      },
      WORKER_SOURCES.pharmacy,
    );
    expect(result.genericName).toBe("Albuterol.");
    expect(result.localBrandNames).toEqual(["Ventolin."]);
    expect(result.customsRules).toBeNull();
    expect(result.carryRules).toBe("Carry a copy.");
  });
});
