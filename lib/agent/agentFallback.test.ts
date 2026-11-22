import { describe, expect, it } from "vitest";
import { buildFallbackPlan } from "./agentFallback";
import { normalizeSpecialistResult, type SpecialistResult } from "./agentParse";
import type { PlannerCapInput, PlannerRequest, SpecialistAgentId } from "./agentTypes";

const request: PlannerRequest = {
  destination: "Lisbon, Portugal",
  origin: "",
  transport: "mixed",
  checkIn: "",
  travelers: 1,
  days: 4,
  condition: "chronic_fatigue_pots",
  medication: "fludrocortisone",
  interests: "",
  budget: "value",
};

const caps: PlannerCapInput[] = Array.from({ length: 4 }, (_, index) => ({
  day: index + 1,
  stepCap: 1800,
  walkingCapKm: 1.1,
  checkpoint: `Checkpoint ${index + 1}`,
}));

function research(): Partial<Record<SpecialistAgentId, SpecialistResult>> {
  return {
    stay: normalizeSpecialistResult("stay", {
      stays: [
        {
          name: "Hotel A",
          area: "Old town",
          lat: 38.71,
          lng: -9.14,
          sourceUrl: "https://example.com/hotel",
        },
      ],
    }),
    table: normalizeSpecialistResult("table", {
      restaurants: [
        {
          name: "Cafe B",
          area: "Old town",
          lat: 38.72,
          lng: -9.13,
          sourceUrl: "https://example.com/cafe",
        },
      ],
    }),
    trail: normalizeSpecialistResult("trail", {
      hikes: [
        {
          name: "Garden loop",
          area: "Garden district",
          lat: 38.73,
          lng: -9.15,
          distanceKm: 1.8,
          sourceUrl: "https://example.com/trail",
        },
      ],
    }),
    culture: normalizeSpecialistResult("culture", {
      visits: [
        {
          name: "Museum C",
          area: "Museum quarter",
          lat: 38.7,
          lng: -9.16,
          sourceUrl: "https://example.com/museum",
        },
      ],
    }),
    care: normalizeSpecialistResult("care", {
      hospitals: [
        {
          name: "Central Hospital",
          address: "1 Main Street",
          lat: 38.74,
          lng: -9.17,
          sourceUrl: "https://example.com/hospital",
        },
      ],
    }),
  };
}

describe("buildFallbackPlan", () => {
  it("builds a degraded plan with a rest day and engine caps", () => {
    const plan = buildFallbackPlan({
      request,
      research: research(),
      caps,
      recoveryMinutes: 90,
      now: "2026-11-21T10:00:00.000Z",
    });
    expect(plan.degraded).toBe(true);
    expect(plan.days).toHaveLength(4);
    expect(plan.days[2]?.restDay).toBe(true);
    expect(plan.days[3]?.restDay).toBe(false);
    expect(plan.days.every((day) => day.withinCaps)).toBe(true);
    expect(plan.days.every((day) => day.recoveryMinutes === 90)).toBe(true);
    expect(plan.places.length).toBeGreaterThan(0);
    expect(plan.sources.length).toBeGreaterThan(0);
    expect(plan.budget.level).toBe("value");
    expect(plan.summary).toContain("concierge route did not finish");
  });

  it("trims or drops an anchor that would exceed a low ceiling", () => {
    const longHike = normalizeSpecialistResult("trail", {
      hikes: [
        {
          name: "Exposed ridge",
          area: "Mountains",
          lat: 38.73,
          lng: -9.15,
          distanceKm: 12,
          elevationM: 900,
          durationMin: 480,
          difficulty: "strenuous",
          sourceUrl: "https://example.com/ridge",
        },
      ],
    });
    const plan = buildFallbackPlan({
      request,
      research: { ...research(), trail: longHike },
      caps,
      recoveryMinutes: 90,
      now: "2026-11-21T10:00:00.000Z",
    });
    for (const day of plan.days) {
      expect(day.withinCaps).toBe(true);
      expect(day.stepEstimate).toBeLessThanOrEqual(day.stepCeiling);
      expect(day.walkingKm).toBeLessThanOrEqual(day.walkingCapKm);
    }
    // Every non-rest day keeps a real block, so the fallback never emits an empty day.
    expect(plan.days.every((day) => day.blocks.length > 0)).toBe(true);
  });

  it("still returns the full trip length with no research picks", () => {
    const plan = buildFallbackPlan({
      request,
      research: {},
      caps,
      recoveryMinutes: 90,
      now: "2026-11-21T10:00:00.000Z",
    });
    expect(plan.days).toHaveLength(4);
    expect(plan.places).toHaveLength(0);
    expect(plan.days[0]?.blocks.length).toBeGreaterThan(0);
  });
});
