import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "./billing/plans";
import {
  DEFAULT_TRIP,
  canBuildTrip,
  canContinueTripStep,
  describePlanAllowance,
  normalizeTripConfig,
  type TripDraft,
} from "./onboarding";

const COMPLETE: TripDraft = {
  ...DEFAULT_TRIP,
  destination: "Lisbon, Portugal",
  condition: "chronic_fatigue_pots",
};

function normalize(draft: TripDraft, maxDays?: number) {
  const result = normalizeTripConfig(draft, maxDays);
  if (result === null) throw new Error("expected a complete trip draft");
  return result;
}

describe("onboarding draft", () => {
  it("starts without a destination and with the general relaxation profile", () => {
    expect(DEFAULT_TRIP.destination).toBe("");
    expect(DEFAULT_TRIP.origin).toBe("");
    expect(DEFAULT_TRIP.days).toBe(4);
    expect(DEFAULT_TRIP.condition).toBe("general_wellness");
    expect(DEFAULT_TRIP.budget).toBe("balanced");
    expect(DEFAULT_TRIP.transport).toBe("mixed");
    expect(DEFAULT_TRIP.checkIn).toBe("");
    expect(DEFAULT_TRIP.travelers).toBe(1);
    expect(DEFAULT_TRIP.captureConsent).toBe(false);
    expect("medication" in DEFAULT_TRIP).toBe(false);
    expect("hasSunLifeTravelCoverage" in DEFAULT_TRIP).toBe(false);
  });

  it("requires a destination before the pace step", () => {
    expect(canContinueTripStep(DEFAULT_TRIP)).toBe(false);
    expect(canContinueTripStep({ ...DEFAULT_TRIP, destination: "  " })).toBe(false);
    expect(canContinueTripStep({ ...DEFAULT_TRIP, destination: "Lisbon" })).toBe(true);
  });

  it("defaults to the general profile but still rejects an empty or missing destination", () => {
    expect(canBuildTrip(DEFAULT_TRIP)).toBe(false);
    expect(
      canBuildTrip({ ...DEFAULT_TRIP, destination: "Lisbon, Portugal" }),
    ).toBe(true);
    expect(canBuildTrip({ ...COMPLETE, condition: "" })).toBe(false);
    expect(canBuildTrip(COMPLETE)).toBe(true);
    expect(
      normalizeTripConfig({ ...DEFAULT_TRIP, destination: "Lisbon, Portugal" }),
    ).toMatchObject({ condition: "general_wellness" });
    expect(normalizeTripConfig(DEFAULT_TRIP)).toBeNull();
  });

  it("normalizes labels and clamps the duration", () => {
    expect(
      normalize({
        ...COMPLETE,
        destination: "  Lisbon,   Portugal  ",
        origin: "  Toronto,   ON ",
        days: 20,
        checkIn: " 2026-12-10 ",
        travelers: 3,
        interests: "  quiet food  ",
      }),
    ).toMatchObject({
      destination: "Lisbon, Portugal",
      origin: "Toronto, ON",
      days: 20,
      condition: "chronic_fatigue_pots",
      checkIn: "2026-12-10",
      travelers: 3,
      interests: "quiet food",
    });
    expect(normalize({ ...COMPLETE, days: 1 }).days).toBe(2);
    expect(normalize({ ...COMPLETE, days: 30 }).days).toBe(20);
    expect(normalize({ ...COMPLETE, days: 20 }, 7).days).toBe(7);
    expect(normalize({ ...COMPLETE, days: 4 }, 7).days).toBe(4);
    expect(normalize({ ...COMPLETE, checkIn: "2026-02-30" }).checkIn).toBe("");
    expect(normalize({ ...COMPLETE, travelers: 0 }).travelers).toBe(1);
    expect(normalize({ ...COMPLETE, travelers: 12 }).travelers).toBe(8);
  });

  it("keeps the selected transport", () => {
    expect(normalize({ ...COMPLETE, transport: "walk" }).transport).toBe("walk");
  });

  it("normalizes a saved draft written before dates and travellers", () => {
    const legacy = { ...COMPLETE } as Record<string, unknown>;
    delete legacy.checkIn;
    delete legacy.travelers;
    const normalized = normalize(legacy as unknown as TripDraft);
    expect(normalized.checkIn).toBe("");
    expect(normalized.travelers).toBe(1);
  });

  it("ignores removed fields on an older stored draft", () => {
    const legacy = {
      ...COMPLETE,
      medication: "albuterol",
      hasSunLifeTravelCoverage: true,
    } as unknown as TripDraft;
    const normalized = normalize(legacy);
    expect("medication" in normalized).toBe(false);
    expect("hasSunLifeTravelCoverage" in normalized).toBe(false);
    expect(normalized.destination).toBe("Lisbon, Portugal");
  });

  it("bounds long labels to the API limits", () => {
    const config = normalize({
      ...COMPLETE,
      destination: "x".repeat(200),
      origin: "w".repeat(200),
      interests: "z".repeat(300),
    });
    expect(config.destination).toHaveLength(120);
    expect(config.origin).toHaveLength(120);
    expect(config.interests).toHaveLength(240);
  });
});

describe("plan allowance", () => {
  it("names the free plan's live allowance and trip ceiling", () => {
    expect(
      describePlanAllowance({ plan: "free_user", ...PLAN_LIMITS.free_user }),
    ).toBe("Free Preview includes 1 live plan a year and trips up to 7 days.");
  });

  it("names the paid plan's live allowance and trip ceiling", () => {
    expect(
      describePlanAllowance({ plan: "care_circle", ...PLAN_LIMITS.care_circle }),
    ).toBe("Care Circle includes 2 live plans a month and trips up to 20 days.");
  });

  it("never claims a remaining count", () => {
    expect(
      describePlanAllowance({ plan: "care_circle", ...PLAN_LIMITS.care_circle }),
    ).not.toContain("remaining");
  });
});
