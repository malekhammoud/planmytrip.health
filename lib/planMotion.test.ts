import { describe, expect, it } from "vitest";
import type { HealthTripPlan } from "@/lib/healthTripEngine";
import {
  PLAN_TWEEN_MS,
  detectPlanDiffs,
  easeOutCubic,
  tweenValue,
} from "./planMotion";

function plan(overrides: Partial<HealthTripPlan> = {}): HealthTripPlan {
  return {
    healthSafetyScore: 78,
    baselineScore: 52,
    riskReductionPct: 54,
    dailyStepCeiling: 6000,
    itinerary: [],
    ...overrides,
  };
}

describe("easeOutCubic and tweenValue", () => {
  it("clamps progress and hits exact endpoints", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(PLAN_TWEEN_MS).toBe(300);
  });

  it("is monotonic and interpolates", () => {
    const samples = [0, 0.25, 0.5, 0.75, 1].map(easeOutCubic);
    expect(samples[0]).toBe(0);
    expect(samples[4]).toBe(1);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]!).toBeGreaterThanOrEqual(samples[index - 1]!);
    }
    expect(tweenValue(6000, 5000, 0)).toBe(6000);
    expect(tweenValue(6000, 5000, 1)).toBe(5000);
    expect(tweenValue(6000, 5000, 0.5)).toBeGreaterThan(5000);
    expect(tweenValue(6000, 5000, 0.5)).toBeLessThan(6000);
  });
});

describe("detectPlanDiffs", () => {
  it("returns nothing for an unchanged plan", () => {
    expect(detectPlanDiffs(plan(), plan())).toEqual([]);
  });

  it("describes each changed KPI with units", () => {
    const diffs = detectPlanDiffs(
      plan(),
      plan({ healthSafetyScore: 74, dailyStepCeiling: 5000, riskReductionPct: 60 }),
    );
    expect(diffs.map((diff) => diff.key)).toEqual([
      "healthSafetyScore",
      "dailyStepCeiling",
      "riskReductionPct",
    ]);
    expect(diffs[0]?.text).toBe("Health safety score 78/100 to 74/100");
    expect(diffs[1]?.text).toBe("Step ceiling 6,000 to 5,000 steps");
    expect(diffs[2]?.text).toBe("Risk reduction 54% to 60%");
  });
});
