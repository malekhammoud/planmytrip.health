import { describe, expect, it } from "vitest";
import { CONDITION_LABELS, CONDITIONS, isCondition } from "@/lib/types";

describe("condition vocabulary", () => {
  it("has five conditions, each with a label", () => {
    expect(CONDITIONS).toHaveLength(5);
    for (const condition of CONDITIONS) {
      expect(CONDITION_LABELS[condition].length).toBeGreaterThan(0);
    }
  });

  it("narrows known identifiers and rejects anything else", () => {
    expect(isCondition("chronic_fatigue_pots")).toBe(true);
    expect(isCondition("diabetes")).toBe(false);
    expect(isCondition(null)).toBe(false);
    expect(isCondition(7)).toBe(false);
  });
});
