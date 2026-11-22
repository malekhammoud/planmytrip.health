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
      origin: "",
      days: 4,
      condition: "asthma_respiratory",
      medication: "albuterol",
      interests: "quiet food and short walks",
      budget: "balanced",
      transport: "mixed",
      checkIn: "",
      travelers: 1,
      captureConsent: false,
      hasSunLifeTravelCoverage: false,
    });
  });

  it("normalises the origin and keeps an explicit transport", () => {
    expect(
      parsePlannerRequest({
        ...valid,
        origin: "  Toronto,  ON ",
        transport: "walk",
      }),
    ).toMatchObject({ origin: "Toronto, ON", transport: "walk" });
  });

  it("defaults a missing budget to balanced", () => {
    expect(parsePlannerRequest({ ...valid, budget: undefined })).toMatchObject({
      budget: "balanced",
    });
  });

  it("defaults a missing transport to mixed", () => {
    expect(parsePlannerRequest({ ...valid, transport: undefined })).toMatchObject({
      transport: "mixed",
    });
  });

  it("accepts empty preferences", () => {
    expect(parsePlannerRequest({ ...valid, interests: "" })).toMatchObject({
      interests: "",
    });
  });

  it("accepts a 20-day trip and normalises the date and travellers", () => {
    expect(
      parsePlannerRequest({
        ...valid,
        days: 20,
        checkIn: " 2026-12-10 ",
        travelers: 3,
      }),
    ).toMatchObject({ days: 20, checkIn: "2026-12-10", travelers: 3 });
  });

  it.each([
    ["destination", { ...valid, destination: "   " }],
    ["days low", { ...valid, days: 1 }],
    ["days high", { ...valid, days: 21 }],
    ["check-in", { ...valid, checkIn: "2026-02-30" }],
    ["travellers low", { ...valid, travelers: 0 }],
    ["travellers high", { ...valid, travelers: 9 }],
    ["travellers fraction", { ...valid, travelers: 1.5 }],
    ["days fraction", { ...valid, days: 3.5 }],
    ["condition", { ...valid, condition: "unknown" }],
    ["medication", { ...valid, medication: 3 }],
    ["interests long", { ...valid, interests: "x".repeat(241) }],
    ["origin long", { ...valid, origin: "x".repeat(121) }],
    ["origin type", { ...valid, origin: 7 }],
    ["transport", { ...valid, transport: "hovercraft" }],
    ["budget", { ...valid, budget: "luxury" }],
    ["non-object", "Lisbon"],
    ["array", []],
  ])("rejects %s", (_label, value) => {
    expect(parsePlannerRequest(value)).toBeNull();
  });
});
