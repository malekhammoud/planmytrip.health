/**
 * Step 3 matrix and workload tests.
 *
 * Covers every condition x trip length, modeled caps and stride consistency, Day 1
 * acclimation, full recovery, final-day comparison, determinism, and invariant errors.
 */

import { describe, expect, it } from "vitest";
import { CONDITIONS } from "@/lib/types";
import {
  buildItinerary,
  computeHealthScores,
  CONDITION_PROFILES,
  ItineraryInvariantError,
  MODELED_LOAD_ASSUMPTIONS,
  modelDayLoad,
  type ConditionProfile,
  type HealthTripDay,
} from "@/lib/healthTripEngine";
import { BASE_INPUT, TRIP_LENGTHS, planFor } from "@/tests/healthTripFixtures";

function captureItineraryError(
  profile: ConditionProfile,
): ItineraryInvariantError {
  try {
    buildItinerary(
      2,
      profile,
      "asthma_respiratory",
      BASE_INPUT.destination,
    );
  } catch (error) {
    if (error instanceof ItineraryInvariantError) return error;
    throw error;
  }
  throw new Error("Expected buildItinerary to reject an over-cap day");
}

describe("modeled cap consistency", () => {
  it("uses the conservative 0.5 m stride", () => {
    expect(MODELED_LOAD_ASSUMPTIONS.kmPerStep).toBe(0.0005);
  });

  it("keeps every profile step ceiling inside its walking cap", () => {
    for (const condition of CONDITIONS) {
      const profile = CONDITION_PROFILES[condition];
      expect(
        profile.dailyStepCeiling * MODELED_LOAD_ASSUMPTIONS.kmPerStep,
      ).toBeLessThanOrEqual(profile.maxWalkingKm);
    }
  });
});

describe.each(CONDITIONS)("condition profile: %s", (condition) => {
  const profile = CONDITION_PROFILES[condition];

  it.each(TRIP_LENGTHS)("builds a valid %i-day plan", (days) => {
    const plan = planFor(condition, days);

    expect(plan.itinerary).toHaveLength(days);
    expect(plan.dailyStepCeiling).toBe(profile.dailyStepCeiling);
    expect(Number.isInteger(plan.healthSafetyScore)).toBe(true);
    expect(plan.healthSafetyScore).toBeGreaterThanOrEqual(0);
    expect(plan.healthSafetyScore).toBeLessThanOrEqual(100);
    expect(Number.isInteger(plan.baselineScore)).toBe(true);
    expect(plan.baselineScore).toBeGreaterThanOrEqual(0);
    expect(plan.baselineScore).toBeLessThanOrEqual(100);
    expect(Number.isInteger(plan.riskReductionPct)).toBe(true);
    expect(plan.riskReductionPct).toBeGreaterThanOrEqual(0);
    expect(plan.riskReductionPct).toBeLessThanOrEqual(100);

    for (const [index, day] of plan.itinerary.entries()) {
      expect(day.day).toBe(index + 1);
      expect(Number.isInteger(day.stepCap)).toBe(true);
      expect(day.stepCap).toBeGreaterThan(0);
      expect(day.stepCap).toBeLessThanOrEqual(profile.dailyStepCeiling);
      expect(day.walkingCapKm).toBeGreaterThan(0);
      expect(day.walkingCapKm).toBeLessThanOrEqual(profile.maxWalkingKm);
      expect(
        day.stepCap * MODELED_LOAD_ASSUMPTIONS.kmPerStep,
      ).toBeLessThanOrEqual(day.walkingCapKm);

      const load = modelDayLoad(day);
      expect(load.steps).toBeLessThanOrEqual(day.stepCap);
      expect(load.walkingKm).toBeLessThanOrEqual(day.walkingCapKm);
      expect(load.recoveryMinutes).toBe(profile.recoveryMinutes);

      expect(day.title.trim().length).toBeGreaterThan(0);
      expect(day.pacingRule.trim().length).toBeGreaterThan(0);
      expect(day.healthCheckpoint.trim().length).toBeGreaterThan(0);
      expect(day.blocks.length).toBeGreaterThan(0);

      for (const block of day.blocks) {
        expect(block.label.trim().length).toBeGreaterThan(0);
        expect(block.label).toContain(BASE_INPUT.destination);
        expect([1, 2, 3]).toContain(block.exertion);
        expect(Number.isInteger(block.durationMin)).toBe(true);
        expect(block.durationMin).toBeGreaterThan(0);
      }

      const recovery = day.blocks.find((block) => block.kind === "recovery");
      expect(recovery).toBeDefined();
      expect(recovery?.durationMin).toBeGreaterThanOrEqual(
        profile.recoveryMinutes,
      );
    }

    const firstDay = plan.itinerary[0];
    const firstDayText = firstDay.blocks
      .map((block) => block.label.toLowerCase())
      .join(" ");
    expect(firstDay.blocks[0]?.kind).toBe("acclimation");
    expect(firstDayText).toContain("sleep");
    expect(firstDayText).toContain("settle in");
    if (condition === "general_wellness") {
      expect(firstDayText).not.toContain("hospital");
    } else {
      expect(firstDayText).toContain("hospital");
    }
    expect(firstDayText).not.toContain("pharmacy");
    expect(firstDayText).not.toContain("medication");

    const finalDay = plan.itinerary[days - 1];
    expect(finalDay.stepCap).toBeLessThan(firstDay.stepCap);
    if (days > 2) {
      expect(finalDay.stepCap).toBeLessThan(plan.itinerary[1].stepCap);
    }
  });
});

describe("final-day cap", () => {
  it("is lighter than Day 1 for a 2-day trip", () => {
    const plan = planFor("asthma_respiratory", 2);
    expect(plan.itinerary[1].stepCap).toBeLessThan(plan.itinerary[0].stepCap);
  });
});

describe("determinism and score variation", () => {
  it("returns deeply equal output for the same input", () => {
    expect(planFor("chronic_fatigue_pots", 6)).toEqual(
      planFor("chronic_fatigue_pots", 6),
    );
  });

  it("varies the modeled score by condition and trip length", () => {
    const scores = CONDITIONS.map(
      (condition) => planFor(condition, 4).healthSafetyScore,
    );
    expect(new Set(scores).size).toBeGreaterThanOrEqual(3);

    for (const condition of CONDITIONS) {
      expect(planFor(condition, 7).healthSafetyScore).toBeLessThan(
        planFor(condition, 2).healthSafetyScore,
      );
    }
  });

  it("saturates trip-length pressure at seven days", () => {
    const seven = planFor("asthma_respiratory", 7);
    const twenty = planFor("asthma_respiratory", 20);
    expect(twenty.healthSafetyScore).toBe(seven.healthSafetyScore);
    expect(twenty.itinerary).toHaveLength(20);
  });

  it("lowers the score when exposure rises and recovery disappears", () => {
    const profile = CONDITION_PROFILES.asthma_respiratory;
    const baseDay: HealthTripDay = {
      day: 1,
      title: "Modeled day",
      stepCap: 20000,
      walkingCapKm: 20,
      pacingRule: "Modeled.",
      healthCheckpoint: "Modeled.",
      blocks: [
        { kind: "cultural", label: "Low-exertion visit", durationMin: 60, exertion: 1 },
        { kind: "recovery", label: "Recovery", durationMin: 60, exertion: 1 },
      ],
    };
    const conservative = computeHealthScores([baseDay], profile, 2);
    const exposed = computeHealthScores(
      [
        {
          ...baseDay,
          blocks: [
            { kind: "cultural", label: "High-exertion visit", durationMin: 240, exertion: 3 },
          ],
        },
      ],
      profile,
      2,
    );

    expect(exposed.healthSafetyScore).toBeLessThan(
      conservative.healthSafetyScore,
    );
    expect(exposed.riskReductionPct).toBeLessThan(
      conservative.riskReductionPct,
    );
  });
});

describe("walking load and cap enforcement", () => {
  it("does not count meal or recovery minutes as walking steps", () => {
    const restDay: HealthTripDay = {
      day: 1,
      title: "Rest day",
      stepCap: 1000,
      walkingCapKm: 1,
      pacingRule: "Rest.",
      healthCheckpoint: "Rest.",
      blocks: [
        { kind: "meal", label: "Meal", durationMin: 60, exertion: 1 },
        { kind: "recovery", label: "Recovery", durationMin: 90, exertion: 1 },
      ],
    };
    const load = modelDayLoad(restDay);
    expect(load.steps).toBe(0);
    expect(load.walkingKm).toBe(0);
    expect(load.recoveryMinutes).toBe(90);

    const recoveryOnly = {
      ...restDay,
      blocks: restDay.blocks.filter((block) => block.kind === "recovery"),
    };
    const recoveryLoad = modelDayLoad(recoveryOnly);
    expect(recoveryLoad.steps).toBe(0);
    expect(recoveryLoad.walkingKm).toBe(0);
  });

  it("throws ItineraryInvariantError for synthetic over-cap profiles", () => {
    const stepLimited = {
      ...CONDITION_PROFILES.asthma_respiratory,
      dailyStepCeiling: 100,
    };
    const walkingLimited = {
      ...CONDITION_PROFILES.asthma_respiratory,
      maxWalkingKm: 0.1,
    };
    expect(captureItineraryError(stepLimited).code).toBe("steps_exceed_cap");
    expect(captureItineraryError(walkingLimited).code).toBe(
      "walking_exceed_cap",
    );
  });
});
