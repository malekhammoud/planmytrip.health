/**
 * Step 3 rules, validation, documentation, and module-boundary tests.
 *
 * Covers Sun Life boundaries and notices, invalid inputs, profile floor/VERIFY text,
 * medication safety copy, module re-export identity, and the pacing policy.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONDITIONS, type Condition } from "@/lib/types";
import {
  buildHealthTripPlan,
  buildItinerary,
  checkSunLifeCoverage,
  computeHealthScores,
  CONDITION_PROFILES,
  DEFAULT_MEDICATION_BY_CONDITION,
  HealthTripInputError,
  MEDICATION_DISCLAIMER,
  PACING_POLICY,
  SUN_LIFE_RULES,
  SUN_LIFE_STABILITY_WINDOW_DAYS_PLACEHOLDER,
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
import { SUN_LIFE_RULES as SUN_LIFE_RULES_MODULE } from "@/lib/sunLifeRules";
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

describe("Sun Life rules", () => {
  it("allows 1 and 60 days with coverage", () => {
    expect(checkSunLifeCoverage(1, true).severity).toBe("ok");
    expect(checkSunLifeCoverage(60, true).severity).toBe("ok");
  });

  it("blocks 61 days and carries the shared notices", () => {
    const alert = checkSunLifeCoverage(61, true);
    expect(alert.severity).toBe("blocking");
    expect(alert.messages).toContain(SUN_LIFE_RULES.administratorNotice);
    expect(alert.messages).toContain(SUN_LIFE_RULES.stabilityWindow.note);
    expect(alert.messages.join(" ")).toContain("not confirmed");
  });

  it("cautions when coverage is absent", () => {
    const alert = checkSunLifeCoverage(30, false);
    expect(alert.severity).toBe("caution");
    expect(alert.messages).toContain(SUN_LIFE_RULES.administratorNotice);
    expect(alert.messages.length).toBeGreaterThan(0);
  });

  it("binds the stability window to the null placeholder", () => {
    expect(SUN_LIFE_RULES.tripDayCap).toBe(60);
    expect(SUN_LIFE_RULES.stabilityWindow.days).toBe(
      SUN_LIFE_STABILITY_WINDOW_DAYS_PLACEHOLDER,
    );
    expect(SUN_LIFE_RULES.stabilityWindow.days).toBeNull();
    expect(SUN_LIFE_RULES.stabilityWindow.isPlaceholder).toBe(true);
    expect(SUN_LIFE_RULES.stabilityWindow.note).toContain("not confirmed");
    expect(SUN_LIFE_RULES.stabilityWindow.note).not.toContain(
      "Verify with your plan administrator",
    );
  });

  it("builds every severity from the administrator notice constant", () => {
    for (const alert of [
      checkSunLifeCoverage(1, true),
      checkSunLifeCoverage(30, false),
      checkSunLifeCoverage(61, true),
    ]) {
      expect(alert.messages).toContain(SUN_LIFE_RULES.administratorNotice);
    }
  });

  it("rejects 0 and 1.5 trip days", () => {
    for (const tripDays of [0, 1.5]) {
      const error = captureInputError(() =>
        checkSunLifeCoverage(tripDays, true),
      );
      expect(error.code).toBe("invalid_days");
      expect(error.field).toBe("days");
    }
  });
});

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
      { input: { ...BASE_INPUT, days: 8 }, code: "invalid_days", field: "days" },
      { input: { ...BASE_INPUT, days: 2.5 }, code: "invalid_days", field: "days" },
      {
        input: { ...BASE_INPUT, condition: "diabetes" as unknown as Condition },
        code: "invalid_condition",
        field: "condition",
      },
      {
        input: { ...BASE_INPUT, medication: 42 as unknown as string },
        code: "invalid_medication",
        field: "medication",
      },
      {
        input: {
          ...BASE_INPUT,
          hasSunLifeTravelCoverage: "yes" as unknown as boolean,
        },
        code: "invalid_coverage",
        field: "hasSunLifeTravelCoverage",
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
});

describe("profile documentation and medication names", () => {
  it("mentions the residual-risk floor in every rationale", () => {
    for (const condition of CONDITIONS) {
      const profile = CONDITION_PROFILES[condition];
      expect(profile.rationale.trim().length).toBeGreaterThan(20);
      expect(profile.rationale).toContain(
        `residual-risk floor: ${profile.residualRiskFloor}`,
      );
    }
  });

  it("keeps floor-aware profile VERIFY lines and policy VERIFY markers", () => {
    const profilesSource = readFileSync(
      fileURLToPath(new URL("./conditionProfiles.ts", import.meta.url)),
      "utf8",
    );
    const rulesSource = readFileSync(
      fileURLToPath(new URL("./sunLifeRules.ts", import.meta.url)),
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
    expect(
      (rulesSource.match(/\/\/\s*VERIFY\b/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    expect(rulesSource).toContain("// VERIFY against current group policy");
  });

  it("lists generic medication names without doses", () => {
    for (const condition of CONDITIONS) {
      const medication = DEFAULT_MEDICATION_BY_CONDITION[condition];
      expect(medication.trim().length).toBeGreaterThan(0);
      expect(medication).not.toMatch(/\d/);
    }
    expect(MEDICATION_DISCLAIMER.length).toBeGreaterThan(20);
  });
});

describe("module boundaries and re-exports", () => {
  it("re-exports the split modules and policy constants", () => {
    expect(CONDITION_PROFILES).toBe(CONDITION_PROFILES_MODULE);
    expect(SUN_LIFE_RULES).toBe(SUN_LIFE_RULES_MODULE);
    expect(buildItinerary).toBe(buildItineraryModule);
    expect(computeHealthScores).toBe(computeHealthScoresModule);
    expect(PACING_POLICY).toBe(PACING_POLICY_MODULE);
    expect(TRIP_DAYS_MIN).toBe(2);
    expect(TRIP_DAYS_MAX).toBe(7);
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
      "albuterol",
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
        8,
        CONDITION_PROFILES.asthma_respiratory,
        "asthma_respiratory",
        "Tokyo, Japan",
        "albuterol",
      ),
    );
    expect(error.code).toBe("invalid_days");
  });
});
