import { describe, expect, it } from "vitest";
import {
  computeEngineDose,
  computePlannerDose,
  computeTripFeatures,
  reconcileDayCaps,
} from "./dose";
import { CONDITION_PROFILES } from "../conditionProfiles";
import { buildHealthTripPlan } from "../healthTripEngine";
import type { PlannerDay, PlannerPlace } from "../agent/agentTypes";

function place(overrides: Partial<PlannerPlace> = {}): PlannerPlace {
  return {
    id: "place-1",
    name: "Museum",
    category: "visit",
    area: "Centre",
    lat: null,
    lng: null,
    why: "",
    notes: null,
    priceBand: null,
    durationMin: 60,
    nights: null,
    distanceKm: null,
    elevationM: null,
    difficulty: null,
    booking: null,
    sourceUrl: null,
    address: null,
    phone: null,
    careType: null,
    day: 1,
    ...overrides,
  };
}

function day(overrides: Partial<PlannerDay> = {}): PlannerDay {
  return {
    day: 1,
    title: "Day one",
    area: "Centre",
    restDay: false,
    stepEstimate: 999_999,
    walkingKm: 99,
    recoveryMinutes: 0,
    blocks: [
      {
        time: "10:00",
        kind: "visit",
        title: "Museum",
        detail: "",
        durationMin: 60,
        placeId: "place-1",
      },
      {
        time: "12:00",
        kind: "meal",
        title: "Lunch",
        detail: "",
        durationMin: 30,
        placeId: null,
      },
      {
        time: "15:00",
        kind: "rest",
        title: "Recovery",
        detail: "",
        durationMin: 30,
        placeId: null,
      },
    ],
    stepCeiling: 5_000,
    walkingCapKm: 3,
    withinCaps: true,
    checkpoint: "Check in.",
    ...overrides,
  };
}

describe("computePlannerDose", () => {
  it("computes from blocks and ignores the agent's self-report", () => {
    const dose = computePlannerDose([day()], [place()], "concierge")[0];
    // 60 min visit at exertion 1 -> 360 steps; meal and rest add none.
    expect(dose.steps).toBe(360);
    expect(dose.walkingKm).toBeCloseTo(0.18, 3);
    expect(dose.recoveryMinutes).toBe(30);
    expect(dose.activeMinutes).toBe(120);
    expect(dose.withinCaps).toBe(true);
    expect(dose.empty).toBe(false);
    expect(dose.source).toBe("concierge");
  });

  it("marks an empty day unsafe instead of treating zero as safe", () => {
    const dose = computePlannerDose(
      [day({ blocks: [], stepEstimate: 0, walkingKm: 0 })],
      [],
      "fallback",
    )[0];
    expect(dose.empty).toBe(true);
    expect(dose.withinCaps).toBe(false);
  });

  it("raises hike exertion from verified elevation", () => {
    const hike = place({
      category: "hike",
      distanceKm: 9,
      elevationM: 420,
      difficulty: "strenuous",
    });
    const hikeDay = day({
      blocks: [
        {
          time: "09:00",
          kind: "hike",
          title: "Ridge",
          detail: "",
          durationMin: 60,
          placeId: "place-1",
        },
      ],
    });
    const dose = computePlannerDose([hikeDay], [hike], "concierge")[0];
    expect(dose.steps).toBe(3_300);
    expect(dose.withinCaps).toBe(true);
  });

  it("fails an over-cap day using computed values", () => {
    const dose = computePlannerDose(
      [day({ stepCeiling: 100, walkingCapKm: 0.01 })],
      [place()],
      "concierge",
    )[0];
    expect(dose.withinCaps).toBe(false);
  });
});

describe("reconcileDayCaps", () => {
  it("catches a long block that the agent estimate understated", () => {
    const hike = place({
      category: "hike",
      distanceKm: 5,
      elevationM: 200,
      difficulty: "moderate",
    });
    const understated = day({
      stepEstimate: 0,
      walkingKm: 0,
      stepCeiling: 5_000,
      walkingCapKm: 3,
      blocks: [
        {
          time: "09:00",
          kind: "hike",
          title: "Long ridge",
          detail: "",
          durationMin: 240,
          placeId: "place-1",
        },
      ],
    });
    expect(understated.withinCaps).toBe(true);
    const [reconciled] = reconcileDayCaps([understated], [hike]);
    // 240 min at exertion 2 -> 6,240 steps, above the 5,000 ceiling.
    expect(reconciled.withinCaps).toBe(false);
  });

  it("keeps a day inside both caps when the blocks fit", () => {
    const [reconciled] = reconcileDayCaps([day()], [place()]);
    expect(reconciled.withinCaps).toBe(true);
  });

  it("leaves a rest day with only non-walking blocks inside its caps", () => {
    const rest = day({
      stepEstimate: 0,
      walkingKm: 0,
      blocks: [
        {
          time: "15:00",
          kind: "rest",
          title: "Recovery",
          detail: "",
          durationMin: 90,
          placeId: null,
        },
      ],
    });
    const [reconciled] = reconcileDayCaps([rest], []);
    expect(reconciled.withinCaps).toBe(true);
  });
});

describe("computeEngineDose", () => {
  it("matches the engine's own modeled load", () => {
    const plan = buildHealthTripPlan({
      destination: "Lisbon, Portugal",
      days: 4,
      condition: "asthma_respiratory",
      medication: "albuterol inhaler",
      hasSunLifeTravelCoverage: false,
    });
    const dose = computeEngineDose(plan.itinerary);
    expect(dose).toHaveLength(4);
    expect(dose.every((row) => row.source === "engine")).toBe(true);
    expect(dose.every((row) => row.withinCaps)).toBe(true);
    for (const row of dose) {
      const engineDay = plan.itinerary[row.day - 1];
      expect(row.stepCeiling).toBe(engineDay.stepCap);
      expect(row.walkingCapKm).toBe(engineDay.walkingCapKm);
    }
  });
});

describe("computeTripFeatures", () => {
  it("uses the condition ceiling, not the day cap, for peak exposure", () => {
    const profile = CONDITION_PROFILES.asthma_respiratory;
    const features = computeTripFeatures({
      dose: [
        {
          day: 1,
          steps: profile.dailyStepCeiling,
          walkingKm: 1,
          activeMinutes: 60,
          exertionWeightedMinutes: 60,
          recoveryMinutes: profile.recoveryMinutes,
          stepCeiling: 1_000,
          walkingCapKm: 1,
          withinCaps: false,
          empty: false,
          source: "concierge",
        },
      ],
      profile,
      days: 1,
    });
    expect(features.peakExposure).toBe(1);
    expect(features.recoveryCoverage).toBe(1);
    expect(features.tripLength).toBe(1);
  });

  it("flags altitude above the profile limit", () => {
    const profile = CONDITION_PROFILES.asthma_respiratory;
    const features = computeTripFeatures({
      dose: [],
      profile,
      days: 2,
      places: [place({ elevationM: profile.altitude.maxMeters + 1 })],
    });
    expect(features.altitudeFlag).toBe(1);
  });
});
