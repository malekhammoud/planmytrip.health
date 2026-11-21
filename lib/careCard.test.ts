/**
 * Unit tests for the deterministic care-card text builder.
 *
 * Covers the exact section format, whitespace normalization, the no-medication
 * fallback, engine integration, the empty-itinerary fallback, and the absence of
 * added doses.
 */

import { describe, expect, it } from "vitest";
import { buildCareCard } from "@/lib/careCard";
import { buildHealthTripPlan, type HealthTripPlan } from "@/lib/healthTripEngine";

const PLAN: HealthTripPlan = {
  healthSafetyScore: 78,
  baselineScore: 52,
  riskReductionPct: 54,
  dailyStepCeiling: 7000,
  sunLifeAlert: {
    severity: "caution",
    title: "Sun Life coverage is not confirmed",
    messages: [
      "No Sun Life travel coverage is recorded for this trip.",
      "Verify with your plan administrator",
    ],
  },
  itinerary: [
    {
      day: 1,
      title: "Acclimation and pharmacy setup in Tokyo, Japan",
      stepCap: 3150,
      walkingCapKm: 1.8,
      pacingRule: "First day pacing rule.",
      blocks: [],
      healthCheckpoint: "Pause if breathing feels harder than usual.",
    },
    {
      day: 2,
      title: "Lighter final day in Tokyo, Japan",
      stepCap: 2800,
      walkingCapKm: 1.6,
      pacingRule: "Final day pacing rule.",
      blocks: [],
      healthCheckpoint: "Keep the return transfer unhurried.",
    },
  ],
};

describe("buildCareCard", () => {
  it("builds the exact documented format", () => {
    expect(buildCareCard("Tokyo, Japan", "asthma_respiratory", "albuterol inhaler", PLAN)).toBe(
      [
        "PlanMyTrip.health care card",
        "Destination: Tokyo, Japan",
        "Condition: asthma or respiratory conditions",
        "Medication: albuterol inhaler",
        "Trip length: 2 days",
        "Daily step ceiling: 7,000 steps",
        "",
        "Sun Life",
        "Sun Life coverage is not confirmed",
        "- No Sun Life travel coverage is recorded for this trip.",
        "- Verify with your plan administrator",
        "",
        "Daily checkpoints",
        "Day 1 (step cap 3,150 steps): Pause if breathing feels harder than usual.",
        "Day 2 (step cap 2,800 steps): Keep the return transfer unhurried.",
        "",
        "Planning aid only. Not medical advice. Confirm with your clinician and insurer before you travel.",
      ].join("\n"),
    );
  });

  it("is deterministic and has no trailing newline", () => {
    const first = buildCareCard("Tokyo, Japan", "asthma_respiratory", "albuterol inhaler", PLAN);
    const second = buildCareCard("Tokyo, Japan", "asthma_respiratory", "albuterol inhaler", PLAN);
    expect(second).toBe(first);
    expect(first.endsWith("\n")).toBe(false);
  });

  it("normalizes whitespace and handles a missing medication", () => {
    const card = buildCareCard("  Tokyo,   Japan  ", "asthma_respiratory", "   ", PLAN);
    expect(card).toContain("Destination: Tokyo, Japan");
    expect(card).toContain("Medication: None recorded");
    expect(card).toContain("Condition: asthma or respiratory conditions");
  });

  it("uses the engine output without adding doses", () => {
    const plan = buildHealthTripPlan({
      destination: "Tokyo, Japan",
      days: 4,
      condition: "asthma_respiratory",
      medication: "albuterol inhaler",
      hasSunLifeTravelCoverage: false,
    });
    const card = buildCareCard(
      "Tokyo, Japan",
      "asthma_respiratory",
      "albuterol inhaler",
      plan,
    );
    expect(card).toContain("Daily step ceiling: 7,000 steps");
    expect(card).toContain("Medication: albuterol inhaler");
    expect(card.split("\n").filter((line) => line.startsWith("Day "))).toHaveLength(4);
    expect(card).not.toMatch(/\bmg\b|\bdose\b/i);
  });

  it("handles an empty itinerary", () => {
    const card = buildCareCard("Tokyo, Japan", "asthma_respiratory", "albuterol inhaler", {
      ...PLAN,
      itinerary: [],
    });
    expect(card).toContain("Trip length: 0 days");
    expect(card).toContain("Daily checkpoints\nNo itinerary days are available.");
  });
});
