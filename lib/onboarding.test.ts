import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRIP,
  canContinueTripStep,
  normalizeTripConfig,
} from "./onboarding";

describe("onboarding draft", () => {
  it("starts without a destination and with a safe default profile", () => {
    expect(DEFAULT_TRIP.destination).toBe("");
    expect(DEFAULT_TRIP.days).toBe(4);
    expect(DEFAULT_TRIP.condition).toBe("asthma_respiratory");
    expect(DEFAULT_TRIP.budget).toBe("balanced");
    expect(DEFAULT_TRIP.hasSunLifeTravelCoverage).toBe(false);
  });

  it("requires a destination before the health step", () => {
    expect(canContinueTripStep(DEFAULT_TRIP)).toBe(false);
    expect(canContinueTripStep({ ...DEFAULT_TRIP, destination: "  " })).toBe(false);
    expect(canContinueTripStep({ ...DEFAULT_TRIP, destination: "Lisbon" })).toBe(true);
  });

  it("normalizes labels and clamps the duration", () => {
    expect(
      normalizeTripConfig({
        ...DEFAULT_TRIP,
        destination: "  Lisbon,   Portugal  ",
        days: 20,
        medication: "  albuterol  ",
        interests: "  quiet food  ",
      }),
    ).toMatchObject({
      destination: "Lisbon, Portugal",
      days: 7,
      medication: "albuterol",
      interests: "quiet food",
    });
    expect(normalizeTripConfig({ ...DEFAULT_TRIP, days: 1 }).days).toBe(2);
  });

  it("bounds long labels to the API limits", () => {
    const config = normalizeTripConfig({
      ...DEFAULT_TRIP,
      destination: "x".repeat(200),
      medication: "y".repeat(200),
      interests: "z".repeat(300),
    });
    expect(config.destination).toHaveLength(120);
    expect(config.medication).toHaveLength(120);
    expect(config.interests).toHaveLength(240);
  });
});
