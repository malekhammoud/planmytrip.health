/**
 * Property tests for the tighten-only verification overlay.
 */

import { describe, expect, it } from "vitest";
import { buildHealthTripPlan } from "@/lib/healthTripEngine";
import type { HealthTripInput, HealthTripPlan } from "@/lib/healthTripEngine";
import { CONDITION_LABELS, type Condition } from "@/lib/types";
import {
  RECOVERY_EXTENSION_MINUTES,
  applyVerification,
  type VerificationFindingInput,
} from "@/lib/verificationOverlay";

const CONDITIONS = Object.keys(CONDITION_LABELS) as Condition[];
const DESTINATION = "Lisbon, Portugal";

function build(condition: Condition, days: number): HealthTripPlan {
  const input: HealthTripInput = {
    destination: DESTINATION,
    days,
    condition,
    medication: "albuterol",
    hasSunLifeTravelCoverage: true,
  };
  return buildHealthTripPlan(input);
}

const advisory: VerificationFindingInput = {
  worker: "advisory",
  findings: {
    destinationRiskLevel: "Exercise a high degree of caution",
    riskSummary: null,
    healthNotices: ["Measles outbreak reported."],
    environmentalHazards: ["Extreme heat and poor air quality."],
  },
  sourceUrl: "https://travel.gc.ca/travelling/advisories",
  retrievedAt: "2026-11-21T12:00:00.000Z",
};

const coverage: VerificationFindingInput = {
  worker: "coverage",
  findings: {
    emergencyMedicalLimit: "CAD 5,000,000",
    preAuthorizationRules: "Call Allianz Global Assistance before non-emergency care.",
    checklist: [],
  },
  sourceUrl: "https://www.sunlife.ca/en/health/emergency-travel-medical-insurance/",
  retrievedAt: "2026-11-21T12:05:00.000Z",
};

function recoveryMinutes(plan: HealthTripPlan, dayIndex: number): number {
  return (
    plan.itinerary[dayIndex]?.blocks.find((block) => block.kind === "recovery")
      ?.durationMin ?? 0
  );
}

describe("applyVerification", () => {
  it("only tightens recovery and never changes caps or scores for every condition and length", () => {
    for (const condition of CONDITIONS) {
      for (let days = 2; days <= 7; days += 1) {
        const base = build(condition, days);
        const result = applyVerification(base, { condition }, [advisory, coverage]);
        expect(result.plan.healthSafetyScore).toBe(base.healthSafetyScore);
        expect(result.plan.baselineScore).toBe(base.baselineScore);
        expect(result.plan.riskReductionPct).toBe(base.riskReductionPct);
        expect(result.plan.dailyStepCeiling).toBe(base.dailyStepCeiling);
        expect(result.plan.itinerary).toHaveLength(days);
        for (const [index, day] of result.plan.itinerary.entries()) {
          const original = base.itinerary[index];
          expect(original).toBeDefined();
          if (original === undefined) continue;
          expect(day.stepCap).toBe(original.stepCap);
          expect(day.walkingCapKm).toBe(original.walkingCapKm);
          expect(recoveryMinutes(result.plan, index)).toBeGreaterThanOrEqual(
            recoveryMinutes(base, index),
          );
          expect(day.healthCheckpoint).toContain("Verified note: Heat notice");
        }
        expect(result.adjustments.some((entry) => entry.kind === "recovery")).toBe(true);
        expect(result.adjustments.some((entry) => entry.kind === "checklist")).toBe(true);
      }
    }
  });

  it("is deterministic and idempotent", () => {
    const base = build("chronic_fatigue_pots", 5);
    const first = applyVerification(base, { condition: "chronic_fatigue_pots" }, [advisory, coverage]);
    const second = applyVerification(base, { condition: "chronic_fatigue_pots" }, [advisory, coverage]);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    const again = applyVerification(
      first.plan,
      { condition: "chronic_fatigue_pots" },
      [advisory, coverage],
    );
    expect(JSON.stringify(again.plan)).toBe(JSON.stringify(first.plan));
  });

  it("is a no-op on null, empty, or unrelated findings", () => {
    const base = build("asthma_respiratory", 4);
    for (const findings of [
      null,
      [] as VerificationFindingInput[],
      [
        {
          ...advisory,
          findings: {
            destinationRiskLevel: null,
            riskSummary: null,
            healthNotices: [],
            environmentalHazards: ["Museum closes on Mondays."],
          },
        } satisfies VerificationFindingInput,
      ],
    ]) {
      const result = applyVerification(base, { condition: "asthma_respiratory" }, findings);
      expect(result.adjustments).toEqual([]);
      expect(JSON.stringify(result.plan)).toBe(JSON.stringify(base));
    }
  });

  it("extends recovery by exactly 30 minutes once per day", () => {
    const condition: Condition = "chronic_fatigue_pots";
    const base = build(condition, 3);
    const result = applyVerification(base, { condition }, [advisory]);
    for (const [index] of base.itinerary.entries()) {
      expect(recoveryMinutes(result.plan, index)).toBe(
        recoveryMinutes(base, index) + RECOVERY_EXTENSION_MINUTES,
      );
    }
    const recoveries = result.adjustments.filter((entry) => entry.kind === "recovery");
    expect(recoveries).toHaveLength(3);
    expect(recoveries.map((entry) => entry.dayIndex)).toEqual([0, 1, 2]);
    expect(recoveries[0]?.fromValue).toBe(90);
    expect(recoveries[0]?.toValue).toBe(120);
  });

  it("honours the master switch and per-adjustment toggles", () => {
    const base = build("asthma_respiratory", 4);
    const off = applyVerification(base, { condition: "asthma_respiratory" }, [advisory, coverage], {
      master: false,
    });
    expect(JSON.stringify(off.plan)).toBe(JSON.stringify(base));
    expect(off.adjustments.every((entry) => !entry.applied)).toBe(true);

    const partial = applyVerification(base, { condition: "asthma_respiratory" }, [advisory], {
      disabledIds: ["recovery:1", "checkpoint:heat"],
    });
    expect(recoveryMinutes(partial.plan, 0)).toBe(recoveryMinutes(base, 0));
    expect(recoveryMinutes(partial.plan, 1)).toBe(
      recoveryMinutes(base, 1) + RECOVERY_EXTENSION_MINUTES,
    );
    expect(partial.plan.itinerary[0]?.healthCheckpoint).not.toContain(
      "Verified note: Heat notice",
    );
    expect(
      partial.adjustments.find((entry) => entry.id === "recovery:1")?.applied,
    ).toBe(false);
  });

  it("adds the coverage checklist as display-only provenance", () => {
    const base = build("severe_food_allergy", 2);
    const result = applyVerification(base, { condition: "severe_food_allergy" }, [coverage]);
    const checklist = result.adjustments.find((entry) => entry.kind === "checklist");
    expect(checklist?.applied).toBe(true);
    expect(checklist?.sourceWorker).toBe("coverage");
    expect(checklist?.sourceUrl).toBe(coverage.sourceUrl);
    expect(checklist?.retrievedAt).toBe(coverage.retrievedAt);
    expect(JSON.stringify(result.plan)).toBe(JSON.stringify(base));
  });
});
