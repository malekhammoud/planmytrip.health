/**
 * Engine rules, validation, documentation, and module-boundary tests.
 *
 * Covers invalid inputs, profile floor/VERIFY text, module re-export identity, and the
 * pacing policy.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONDITIONS, type Condition } from "@/lib/types";
import {
  buildHealthTripPlan,
  buildItinerary,
  computeHealthScores,
  CONDITION_PROFILES,
  HealthTripInputError,
  PACING_POLICY,
  TRIP_DAYS_MAX,
  TRIP_DAYS_MIN,
  type HealthTripInput,
  type HealthTripInputErrorCode,
} from "@/lib/healthTripEngine";
import { CONDITION_PROFILES as CONDITION_PROFILES_MODULE } from "@/lib/conditionProfiles";
import { computeHealthScores as computeHealthScoresModule } from "@/lib/healthScore";
import {
  PACING_POLICY as PACING_POLICY_MODULE,
  buildItinerary as buildItineraryModule,
} from "@/lib/itineraryBuilder";
import { BASE_INPUT, planFor } from "@/tests/healthTripFixtures";

function captureInputError(action: () => unknown): HealthTripInputError {
  try {
    action();
  } catch (error) {
    if (error instanceof HealthTripInputError) return error;
    throw error;
  }
  throw new Error("Expected action to throw HealthTripInputError");
}

describe("input validation", () => {
  it("throws typed errors with stable code and field", () => {
    const cases: Array<{
      input: HealthTripInput;
      code: HealthTripInputErrorCode;
      field: keyof HealthTripInput;
    }> = [
      { input: { ...BASE_INPUT, destination: "" }, code: "invalid_destination", field: "destination" },
      { input: { ...BASE_INPUT, destination: "   " }, code: "invalid_destination", field: "destination" },
      { input: { ...BASE_INPUT, days: 1 }, code: "invalid_days", field: "days" },
      { input: { ...BASE_INPUT, days: 21 }, code: "invalid_days", field: "days" },
      { input: { ...BASE_INPUT, days: 2.5 }, code: "invalid_days", field: "days" },
      {
        input: { ...BASE_INPUT, condition: "diabetes" as unknown as Condition },
        code: "invalid_condition",
        field: "condition",
      },
    ];

    for (const testCase of cases) {
      const error = captureInputError(() =>
        buildHealthTripPlan(testCase.input),
      );
      expect(error).toBeInstanceOf(HealthTripInputError);
      expect(error.name).toBe("HealthTripInputError");
      expect(error.code).toBe(testCase.code);
      expect(error.field).toBe(testCase.field);
    }
  });

  it("builds a plan without coverage or medication fields", () => {
    const plan = planFor("asthma_respiratory", 4);
    expect("sunLifeAlert" in plan).toBe(false);
    expect("medication" in plan).toBe(false);
    expect("hasSunLifeTravelCoverage" in plan).toBe(false);
  });
});

describe("profile documentation", () => {
  it("mentions the residual-risk floor in every rationale", () => {
    for (const condition of CONDITIONS) {
      const profile = CONDITION_PROFILES[condition];
      expect(profile.rationale.trim().length).toBeGreaterThan(20);
      expect(profile.rationale).toContain(
        `residual-risk floor: ${profile.residualRiskFloor}`,
      );
    }
  });

  it("keeps floor-aware profile VERIFY lines", () => {
    const profilesSource = readFileSync(
      fileURLToPath(new URL("./conditionProfiles.ts", import.meta.url)),
      "utf8",
    );
    expect(
      (profilesSource.match(/\/\/\s*VERIFY\b/g) ?? []).length,
    ).toBeGreaterThanOrEqual(5);
    expect(
      (profilesSource.match(/residual-risk floor \(\d+\/100\)/g) ?? []).length,
    ).toBe(5);
    for (const condition of CONDITIONS) {
      expect(profilesSource).toContain(
        `residual-risk floor (${CONDITION_PROFILES[condition].residualRiskFloor}/100)`,
      );
    }
  });
});

describe("module boundaries and re-exports", () => {
  it("re-exports the split modules and policy constants", () => {
    expect(CONDITION_PROFILES).toBe(CONDITION_PROFILES_MODULE);
    expect(buildItinerary).toBe(buildItineraryModule);
    expect(computeHealthScores).toBe(computeHealthScoresModule);
    expect(PACING_POLICY).toBe(PACING_POLICY_MODULE);
    expect(TRIP_DAYS_MIN).toBe(2);
    expect(TRIP_DAYS_MAX).toBe(20);
  });

  it("uses the documented pacing policy", () => {
    expect(PACING_POLICY.firstDayCapFactor).toBe(0.45);
    expect(PACING_POLICY.middleDayCapFactor).toBe(0.8);
    expect(PACING_POLICY.finalDayCapFactor).toBe(0.4);
  });

  it("builds the same itinerary and scores through extracted modules", () => {
    const profile = CONDITION_PROFILES.asthma_respiratory;
    const itinerary = buildItinerary(
      3,
      profile,
      "asthma_respiratory",
      "Tokyo, Japan",
    );
    const plan = planFor("asthma_respiratory", 3);

    expect(itinerary).toEqual(plan.itinerary);
    expect(computeHealthScores(itinerary, profile, 3)).toEqual({
      healthSafetyScore: plan.healthSafetyScore,
      baselineScore: plan.baselineScore,
      riskReductionPct: plan.riskReductionPct,
    });
  });

  it("rejects out-of-range days through the builder boundary", () => {
    const error = captureInputError(() =>
      buildItinerary(
        21,
        CONDITION_PROFILES.asthma_respiratory,
        "asthma_respiratory",
        "Tokyo, Japan",
      ),
    );
    expect(error.code).toBe("invalid_days");
  });
});
