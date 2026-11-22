import { describe, expect, it } from "vitest";
import { clampInteger } from "./numberInput";

describe("clampInteger", () => {
  it("keeps an in-range integer", () => {
    expect(clampInteger(4, 2, 7)).toBe(4);
  });

  it("clamps below and above the range", () => {
    expect(clampInteger(1, 2, 7)).toBe(2);
    expect(clampInteger(10, 2, 7)).toBe(7);
  });

  it("rounds a fractional value and handles non-finite input", () => {
    expect(clampInteger(4.6, 2, 7)).toBe(5);
    expect(clampInteger(Number.NaN, 2, 7)).toBe(2);
    expect(clampInteger(Number.POSITIVE_INFINITY, 2, 7)).toBe(2);
  });
});
