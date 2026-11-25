/**
 * Headline sentence tests for the pure describeTrip helper.
 *
 * Covers the exact reference sentence, destination trimming, the empty fallback,
 * and every plain condition label.
 */

import { describe, expect, it } from "vitest";
import { describeTrip } from "@/lib/describeTrip";
import { CONDITION_LABELS } from "@/lib/types";

describe("describeTrip", () => {
  it("builds the exact headline sentence for a 4-day Tokyo breathing trip", () => {
    expect(
      describeTrip({
        destination: "Tokyo, Japan",
        days: 4,
        condition: "asthma_respiratory",
      }),
    ).toBe("4 days in Tokyo, Japan, paced for asthma or breathing conditions.");
  });

  it("trims surrounding destination whitespace", () => {
    expect(
      describeTrip({
        destination: "  Tokyo, Japan  ",
        days: 4,
        condition: "asthma_respiratory",
      }),
    ).toBe("4 days in Tokyo, Japan, paced for asthma or breathing conditions.");
  });

  it("falls back to your destination when the destination is empty", () => {
    expect(
      describeTrip({
        destination: "",
        days: 4,
        condition: "asthma_respiratory",
      }),
    ).toBe("4 days in your destination, paced for asthma or breathing conditions.");
    expect(
      describeTrip({
        destination: "   ",
        days: 6,
        condition: "asthma_respiratory",
      }),
    ).toBe("6 days in your destination, paced for asthma or breathing conditions.");
  });

  it("uses the label for another condition", () => {
    expect(
      describeTrip({
        destination: "Lisbon, Portugal",
        days: 5,
        condition: "chronic_fatigue_pots",
      }),
    ).toBe(`5 days in Lisbon, Portugal, paced for ${CONDITION_LABELS.chronic_fatigue_pots}.`);
    expect(CONDITION_LABELS.chronic_fatigue_pots).toBe("fatigue or POTS");
  });

  it("uses plain consumer labels for every health profile", () => {
    expect(CONDITION_LABELS).toEqual({
      general_wellness: "relaxation and stress recovery",
      asthma_respiratory: "asthma or breathing conditions",
      chronic_fatigue_pots: "fatigue or POTS",
      pregnancy_second_trimester: "second-trimester pregnancy",
      severe_food_allergy: "severe food allergy",
      cardiac_hypertension: "heart health or high blood pressure",
    });
  });
});
