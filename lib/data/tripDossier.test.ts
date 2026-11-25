import { describe, expect, it } from "vitest";
import type { AgentTripPlan, PlannerDay, PlannerPlace } from "../agent/agentTypes";
import { buildHealthTripPlan } from "../healthTripEngine";
import { buildTripDossier, parseOutcome } from "./tripDossier";

const place: PlannerPlace = {
  id: "place-1",
  name: "Museum",
  category: "visit",
  area: "Centre",
  lat: 38.7,
  lng: -9.1,
  why: "Verified.",
  notes: null,
  priceBand: "€",
  durationMin: 60,
  nights: null,
  distanceKm: null,
  elevationM: null,
  difficulty: null,
  booking: null,
  sourceUrl: "https://example.com/museum",
  address: null,
  phone: null,
  careType: null,
  day: 1,
};

function day(dayNumber: number): PlannerDay {
  return {
    day: dayNumber,
    title: `Day ${dayNumber}`,
    area: "Centre",
    restDay: false,
    stepEstimate: 999_999,
    walkingKm: 99,
    recoveryMinutes: 30,
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
  };
}

const agentPlan: AgentTripPlan = {
  summary: "A paced plan.",
  baseArea: "Centre",
  routeTheme: "Quiet",
  days: [day(1), day(2)],
  places: [place],
  safetyNotes: [],
  bookingChecklist: [],
  budget: {
    level: "balanced",
    estimatedTotal: 900,
    currency: "EUR",
    notes: "",
  },
  sources: [{ title: "Museum", url: "https://example.com/museum" }],
  generatedAt: "2026-11-21T10:00:00.000Z",
};

describe("buildTripDossier", () => {
  it("computes both doses and stores the consent record", () => {
    const enginePlan = buildHealthTripPlan({
      destination: "Lisbon, Portugal",
      days: 2,
      condition: "asthma_respiratory",
    });
    const dossier = buildTripDossier({
      runId: "run-12345678",
      installId: "install-12345678",
      createdAt: "2026-11-21T10:00:00.000Z",
      request: {
        destination: "Lisbon, Portugal",
        days: 2,
        condition: "asthma_respiratory",
        interests: "",
        budget: "balanced",
      },
      enginePlan,
      agentPlan,
      research: [{ agentId: "culture", ok: true, summary: "Two visits." }],
      swarm: [],
    });
    expect(dossier.schemaVersion).toBe(1);
    expect(dossier.engine.dose).toHaveLength(2);
    expect(dossier.plan.days).toHaveLength(2);
    expect(dossier.plan.days[0].steps).toBe(360);
    expect(dossier.plan.source).toBe("concierge");
    expect(dossier.features.peakExposure).toBeGreaterThan(0);
    expect(dossier.consent.capture).toBe(true);
    expect(dossier.verification.research).toHaveLength(1);
  });

  it("marks a degraded plan as fallback", () => {
    const enginePlan = buildHealthTripPlan({
      destination: "Lisbon, Portugal",
      days: 2,
      condition: "asthma_respiratory",
    });
    const dossier = buildTripDossier({
      runId: "run-12345678",
      installId: "install-12345678",
      createdAt: "2026-11-21T10:00:00.000Z",
      request: {
        destination: "Lisbon, Portugal",
        days: 2,
        condition: "asthma_respiratory",
        interests: "",
        budget: "balanced",
      },
      enginePlan,
      agentPlan: { ...agentPlan, degraded: true },
      research: [],
      swarm: [],
    });
    expect(dossier.plan.source).toBe("fallback");
    expect(dossier.plan.degraded).toBe(true);
  });
});

describe("parseOutcome", () => {
  it("requires an explicit flare answer", () => {
    expect(parseOutcome({}, "2026-11-21T10:00:00.000Z")).toBeNull();
    expect(
      parseOutcome({ flare: "no" }, "2026-11-21T10:00:00.000Z"),
    ).toBeNull();
  });

  it("clears flare-only fields for an explicit no", () => {
    const outcome = parseOutcome(
      { flare: false, severity: "severe", care: "er", flareDay: 3 },
      "2026-11-21T10:00:00.000Z",
    );
    expect(outcome).not.toBeNull();
    expect(outcome?.flare).toBe(false);
    expect(outcome?.severity).toBeNull();
    expect(outcome?.care).toBeNull();
    expect(outcome?.flareDay).toBeNull();
  });

  it("keeps a valid positive outcome", () => {
    const outcome = parseOutcome(
      {
        flare: true,
        severity: "moderate",
        care: "clinic",
        adherence: "less",
        flareDay: 3,
        notes: "  Fatigue on day three.  ",
      },
      "2026-11-21T10:00:00.000Z",
    );
    expect(outcome?.severity).toBe("moderate");
    expect(outcome?.care).toBe("clinic");
    expect(outcome?.adherence).toBe("less");
    expect(outcome?.flareDay).toBe(3);
    expect(outcome?.notes).toBeNull();
  });

  it("accepts a flare day up to 20 and drops a day beyond it", () => {
    const kept = parseOutcome(
      { flare: true, flareDay: 20 },
      "2026-11-21T10:00:00.000Z",
    );
    const dropped = parseOutcome(
      { flare: true, flareDay: 21 },
      "2026-11-21T10:00:00.000Z",
    );
    expect(kept?.flareDay).toBe(20);
    expect(dropped?.flareDay).toBeNull();
  });

  it("drops free text on the public contract", () => {
    const outcome = parseOutcome(
      { flare: false, notes: "A private detail." },
      "2026-11-21T10:00:00.000Z",
    );
    expect(outcome?.notes).toBeNull();
  });
});
