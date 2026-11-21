import { describe, expect, it } from "vitest";
import { sliderFillPercent } from "./sliderFill";

describe("sliderFillPercent", () => {
  it("returns 0 at the minimum", () => {
    expect(sliderFillPercent(1, 1, 14)).toBe(0);
  });

  it("returns 100 at the maximum", () => {
    expect(sliderFillPercent(14, 1, 14)).toBe(100);
  });

  it("returns the proportional fill in the middle", () => {
    expect(sliderFillPercent(5, 1, 11)).toBe(40);
  });

  it("clamps values below the minimum", () => {
    expect(sliderFillPercent(-4, 1, 14)).toBe(0);
  });

  it("clamps values above the maximum", () => {
    expect(sliderFillPercent(99, 1, 14)).toBe(100);
  });

  it("returns 0 when the maximum is not greater than the minimum", () => {
    expect(sliderFillPercent(3, 3, 3)).toBe(0);
    expect(sliderFillPercent(3, 5, 1)).toBe(0);
  });

  it("returns 0 for non-finite inputs", () => {
    expect(sliderFillPercent(Number.NaN, 0, 10)).toBe(0);
    expect(sliderFillPercent(5, 0, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
