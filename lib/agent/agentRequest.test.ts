import { describe, expect, it } from "vitest";
import { parsePlannerRequest } from "./agentRequest";

const valid = {
  destination: "  Lisbon, Portugal ",
  days: 4,
  condition: "asthma_respiratory",
  medication: " albuterol ",
  interests: "  quiet food and short walks ",
  budget: "balanced",
};

describe("parsePlannerRequest", () => {
  it("normalises a valid request", () => {
    expect(parsePlannerRequest(valid)).toEqual({
      destination: "Lisbon, Portugal",
      days: 4,
      condition: "asthma_respiratory",
      medication: "albuterol",
      interests: "quiet food and short walks",
      budget: "balanced",
      captureConsent: false,
      hasSunLifeTravelCoverage: false,
    });
  });

  it("defaults a missing budget to balanced", () => {
    expect(parsePlannerRequest({ ...valid, budget: undefined })).toMatchObject({
      budget: "balanced",
    });
  });

  it("accepts empty preferences", () => {
    expect(parsePlannerRequest({ ...valid, interests: "" })).toMatchObject({
      interests: "",
    });
  });

  it.each([
    ["destination", { ...valid, destination: "   " }],
    ["days low", { ...valid, days: 1 }],
    ["days high", { ...valid, days: 8 }],
    ["days fraction", { ...valid, days: 3.5 }],
    ["condition", { ...valid, condition: "unknown" }],
    ["medication", { ...valid, medication: 3 }],
    ["interests long", { ...valid, interests: "x".repeat(241) }],
    ["budget", { ...valid, budget: "luxury" }],
    ["non-object", "Lisbon"],
    ["array", []],
  ])("rejects %s", (_label, value) => {
    expect(parsePlannerRequest(value)).toBeNull();
  });
});
