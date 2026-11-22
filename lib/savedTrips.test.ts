import { describe, expect, it } from "vitest";
import { parseSaveTripBody, parseSavedTripId } from "./savedTrips";

const TRIP = {
  destination: "Lisbon, Portugal",
  origin: "Toronto, Canada",
  days: 4,
  condition: "asthma_respiratory",
  medication: "albuterol inhaler",
  interests: "Quiet food",
  budget: "balanced",
  transport: "mixed",
  captureConsent: true,
  hasSunLifeTravelCoverage: true,
};

const PLAN = {
  summary: "Four paced days in Lisbon.",
  baseArea: "Alfama",
  routeTheme: "Slow mornings",
  days: [
    {
      day: 1,
      title: "Arrival",
      area: "Alfama",
      restDay: false,
      stepEstimate: 2000,
      walkingKm: 1.2,
      recoveryMinutes: 30,
      blocks: [
        {
          time: "09:00",
          kind: "visit",
          title: "Short walk",
          detail: "Stay close to the base.",
          durationMin: 60,
          placeId: null,
        },
      ],
      stepCeiling: 3150,
      walkingCapKm: 2.5,
      withinCaps: true,
      checkpoint: "Stop if breathing changes.",
    },
  ],
  places: [],
  safetyNotes: ["Carry the rescue plan."],
  bookingChecklist: ["Confirm the cancellation terms."],
  budget: {
    level: "balanced",
    estimatedTotal: 1200,
    currency: "CAD",
    notes: "Modeled estimate.",
  },
  sources: [],
  generatedAt: "2026-11-21T10:00:00.000Z",
};

describe("saved trip contract", () => {
  it("normalizes a valid trip and finishes with capture disabled", () => {
    const parsed = parseSaveTripBody(
      { runId: "run-12345678", trip: TRIP, plan: PLAN },
      "2026-11-21T10:05:00.000Z",
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.runId).toBe("run-12345678");
    expect(parsed?.trip.destination).toBe("Lisbon, Portugal");
    expect(parsed?.trip.captureConsent).toBe(false);
    expect(parsed?.trip.hasSunLifeTravelCoverage).toBe(true);
    expect(parsed?.plan.days).toHaveLength(1);
  });

  it("rejects a bad run id, trip, or plan", () => {
    expect(
      parseSaveTripBody(
        { runId: "bad id", trip: TRIP, plan: PLAN },
        "2026-11-21T10:05:00.000Z",
      ),
    ).toBeNull();
    expect(
      parseSaveTripBody(
        { runId: "run-12345678", trip: { ...TRIP, days: 99 }, plan: PLAN },
        "2026-11-21T10:05:00.000Z",
      ),
    ).toBeNull();
    expect(
      parseSaveTripBody(
        { runId: "run-12345678", trip: TRIP, plan: { ...PLAN, summary: "" } },
        "2026-11-21T10:05:00.000Z",
      ),
    ).toBeNull();
  });

  it("never saves sample plans", () => {
    expect(
      parseSaveTripBody(
        { runId: "run-12345678", trip: TRIP, plan: { ...PLAN, mock: true } },
        "2026-11-21T10:05:00.000Z",
      ),
    ).toBeNull();
  });

  it("validates saved-trip ids", () => {
    expect(parseSavedTripId("9f1a26f8-8f91-4a70-9e0a-1c2f421e4f58")).toBe(
      "9f1a26f8-8f91-4a70-9e0a-1c2f421e4f58",
    );
    expect(parseSavedTripId("bad id")).toBeNull();
  });
});
