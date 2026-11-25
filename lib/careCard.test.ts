/**
 * Unit tests for the deterministic care-card text builder.
 *
 * Covers the exact section format, whitespace normalization, engine integration, the
 * empty-itinerary fallback, and applied verification adjustments.
 */

import { describe, expect, it } from "vitest";
import { buildCareCard } from "@/lib/careCard";
import { buildHealthTripPlan, type HealthTripPlan } from "@/lib/healthTripEngine";

const PLAN: HealthTripPlan = {
  healthSafetyScore: 78,
  baselineScore: 52,
  riskReductionPct: 54,
  dailyStepCeiling: 7000,
  itinerary: [
    {
      day: 1,
      title: "Acclimation and settling in to Tokyo, Japan",
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
    expect(buildCareCard("Tokyo, Japan", "asthma_respiratory", PLAN)).toBe(
      [
        "PlanMyTrip.health care card",
        "Destination: Tokyo, Japan",
        "Condition: asthma or breathing conditions",
        "Trip length: 2 days",
        "Daily step ceiling: 7,000 steps",
        "",
        "Daily checkpoints",
        "Day 1 (step cap 3,150 steps): Pause if breathing feels harder than usual.",
        "Day 2 (step cap 2,800 steps): Keep the return transfer unhurried.",
        "",
        "Planning aid only. Not medical advice. Confirm with your clinician and insurer before you travel.",
      ].join("\n"),
    );
  });

  it("has no Sun Life block and no medication line", () => {
    const card = buildCareCard("Tokyo, Japan", "asthma_respiratory", PLAN);
    expect(card).not.toContain("Sun Life");
    expect(card).not.toContain("Medication:");
    expect(card).not.toContain("coverage");
  });

  it("is deterministic and has no trailing newline", () => {
    const first = buildCareCard("Tokyo, Japan", "asthma_respiratory", PLAN);
    const second = buildCareCard("Tokyo, Japan", "asthma_respiratory", PLAN);
    expect(second).toBe(first);
    expect(first.endsWith("\n")).toBe(false);
  });

  it("normalizes whitespace in the destination", () => {
    const card = buildCareCard("  Tokyo,   Japan  ", "asthma_respiratory", PLAN);
    expect(card).toContain("Destination: Tokyo, Japan");
    expect(card).toContain("Condition: asthma or breathing conditions");
  });

  it("uses the engine output without adding doses", () => {
    const plan = buildHealthTripPlan({
      destination: "Tokyo, Japan",
      days: 4,
      condition: "asthma_respiratory",
    });
    const card = buildCareCard("Tokyo, Japan", "asthma_respiratory", plan);
    expect(card).toContain("Daily step ceiling: 7,000 steps");
    expect(card.split("\n").filter((line) => line.startsWith("Day "))).toHaveLength(4);
    expect(card).not.toMatch(/\bmg\b|\bdose\b/i);
  });

  it("handles an empty itinerary", () => {
    const card = buildCareCard("Tokyo, Japan", "asthma_respiratory", {
      ...PLAN,
      itinerary: [],
    });
    expect(card).toContain("Trip length: 0 days");
    expect(card).toContain("Daily checkpoints\nNo itinerary days are available.");
  });

  it("includes only applied verification adjustments with provenance", () => {
    const card = buildCareCard(
      "Tokyo, Japan",
      "asthma_respiratory",
      PLAN,
      [
        {
          id: "recovery:1",
          kind: "recovery",
          dayIndex: 0,
          title: "Recovery extension",
          reason: "heat notice: Extreme heat.",
          sourceUrl: "https://travel.gc.ca/travelling/advisories",
          sourceWorker: "advisory",
          retrievedAt: "2026-11-21T12:00:00.000Z",
          applied: true,
          fromValue: 30,
          toValue: 60,
        },
        {
          id: "checkpoint:outbreak",
          kind: "checkpoint",
          title: "Health-outbreak notice",
          reason: "Measles outbreak reported.",
          sourceUrl: "https://travel.gc.ca/travelling/advisories",
          sourceWorker: "advisory",
          retrievedAt: "2026-11-21T12:00:00.000Z",
          applied: false,
        },
      ],
    );
    expect(card).toContain(
      [
        "Applied verification adjustments",
        "- Day 1 afternoon recovery: 30 to 60 min. Reason: heat notice: Extreme heat. Source: https://travel.gc.ca/travelling/advisories (retrieved 2026-11-21 12:00 UTC)",
        "",
        "Planning aid only.",
      ].join("\n"),
    );
    expect(card).not.toContain("Measles outbreak");
  });
});
