import { describe, expect, it } from "vitest";
import {
  AVOID_WALK_FLOOR_KM,
  chooseLegMode,
  isLongWalk,
  legDurationMin,
  planLeg,
  WALK_CAUTION_KM,
} from "./legs";

describe("chooseLegMode", () => {
  it("walks every leg for a walking trip", () => {
    expect(chooseLegMode(0.4, "walk")).toBe("walk");
    expect(chooseLegMode(9, "walk")).toBe("walk");
  });

  it("walks short hops and rides long ones for mixed transport", () => {
    expect(chooseLegMode(0.8, "mixed")).toBe("walk");
    expect(chooseLegMode(4, "mixed")).toBe("transit");
    expect(chooseLegMode(20, "mixed")).toBe("car");
  });

  it("prefers transit within its range and a car beyond it", () => {
    expect(chooseLegMode(0.5, "transit")).toBe("walk");
    expect(chooseLegMode(3, "transit")).toBe("transit");
  });

  it("walks very short car hops", () => {
    expect(chooseLegMode(0.3, "car")).toBe("walk");
    expect(chooseLegMode(1.2, "car")).toBe("car");
  });

  it("avoids walking on a demanding day when a vehicle is allowed", () => {
    expect(chooseLegMode(1.5, "mixed", true)).toBe("transit");
    expect(chooseLegMode(1.5, "car", true)).toBe("car");
    expect(chooseLegMode(0.3, "mixed", true)).toBe("walk");
  });

  it("keeps a walking trip walking even when the day is demanding", () => {
    expect(chooseLegMode(3, "walk", true)).toBe("walk");
  });

  it("does not treat a tiny leg as avoidable", () => {
    expect(AVOID_WALK_FLOOR_KM).toBeLessThan(1);
  });
});

describe("legDurationMin", () => {
  it("models walking pace", () => {
    expect(legDurationMin(1, "walk")).toBe(14);
  });

  it("adds transit access time", () => {
    expect(legDurationMin(3, "transit")).toBe(18);
  });

  it("adds parking time", () => {
    expect(legDurationMin(10, "car")).toBe(24);
  });

  it("never returns zero minutes", () => {
    expect(legDurationMin(0, "walk")).toBe(1);
  });
});

describe("planLeg", () => {
  it("records walking distance only for a walking leg", () => {
    const walk = planLeg("base", "a", 0.5, "mixed", false);
    const ride = planLeg("a", "b", 4, "mixed", false);
    expect(walk).toMatchObject({ mode: "walk", walkKm: 0.5, from: "base", to: "a" });
    expect(ride).toMatchObject({ mode: "transit", walkKm: 0 });
  });

  it("rounds distance to ten metres", () => {
    expect(planLeg("a", "b", 1.2349, "mixed", false).distanceKm).toBe(1.23);
  });
});

describe("isLongWalk", () => {
  it("flags only walking legs at or above the caution distance", () => {
    expect(isLongWalk(WALK_CAUTION_KM, "walk")).toBe(true);
    expect(isLongWalk(WALK_CAUTION_KM, "transit")).toBe(false);
    expect(isLongWalk(WALK_CAUTION_KM - 0.1, "walk")).toBe(false);
  });
});
