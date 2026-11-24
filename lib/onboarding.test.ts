import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRIP,
  canContinueTripStep,
  normalizeTripConfig,
} from "./onboarding";

describe("onboarding draft", () => {
  it("starts without a destination and with a safe default profile", () => {
    expect(DEFAULT_TRIP.destination).toBe("");
    expect(DEFAULT_TRIP.origin).toBe("");
    expect(DEFAULT_TRIP.days).toBe(4);
    expect(DEFAULT_TRIP.condition).toBe("asthma_respiratory");
    expect(DEFAULT_TRIP.budget).toBe("balanced");
    expect(DEFAULT_TRIP.transport).toBe("mixed");
    expect(DEFAULT_TRIP.checkIn).toBe("");
    expect(DEFAULT_TRIP.travelers).toBe(1);
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
        origin: "  Toronto,   ON ",
        days: 20,
        checkIn: " 2026-12-10 ",
        travelers: 3,
        medication: "  albuterol  ",
        interests: "  quiet food  ",
      }),
    ).toMatchObject({
      destination: "Lisbon, Portugal",
      origin: "Toronto, ON",
      days: 20,
      checkIn: "2026-12-10",
      travelers: 3,
      medication: "albuterol",
      interests: "quiet food",
    });
    expect(normalizeTripConfig({ ...DEFAULT_TRIP, days: 1 }).days).toBe(2);
    expect(normalizeTripConfig({ ...DEFAULT_TRIP, days: 30 }).days).toBe(20);
    expect(normalizeTripConfig({ ...DEFAULT_TRIP, days: 20 }, 7).days).toBe(7);
    expect(normalizeTripConfig({ ...DEFAULT_TRIP, days: 4 }, 7).days).toBe(4);
    expect(normalizeTripConfig({ ...DEFAULT_TRIP, checkIn: "2026-02-30" }).checkIn).toBe("");
    expect(normalizeTripConfig({ ...DEFAULT_TRIP, travelers: 0 }).travelers).toBe(1);
    expect(normalizeTripConfig({ ...DEFAULT_TRIP, travelers: 12 }).travelers).toBe(8);
  });

  it("keeps the selected transport", () => {
    expect(
      normalizeTripConfig({ ...DEFAULT_TRIP, transport: "walk" }).transport,
    ).toBe("walk");
  });

  it("normalizes a saved draft written before dates and travellers", () => {
    const legacy = { ...DEFAULT_TRIP } as Record<string, unknown>;
    delete legacy.checkIn;
    delete legacy.travelers;
    const normalized = normalizeTripConfig(legacy as unknown as typeof DEFAULT_TRIP);
    expect(normalized.checkIn).toBe("");
    expect(normalized.travelers).toBe(1);
  });

  it("bounds long labels to the API limits", () => {
    const config = normalizeTripConfig({
      ...DEFAULT_TRIP,
      destination: "x".repeat(200),
      origin: "w".repeat(200),
      medication: "y".repeat(200),
      interests: "z".repeat(300),
    });
    expect(config.destination).toHaveLength(120);
    expect(config.origin).toHaveLength(120);
    expect(config.medication).toHaveLength(120);
    expect(config.interests).toHaveLength(240);
  });
});
