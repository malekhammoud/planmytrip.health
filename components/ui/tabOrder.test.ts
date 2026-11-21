import { describe, expect, it } from "vitest";
import { nextTabIndex } from "./tabOrder";

describe("nextTabIndex", () => {
  it("wraps arrow movement in both directions", () => {
    expect(nextTabIndex(0, "ArrowRight", 4)).toBe(1);
    expect(nextTabIndex(3, "ArrowRight", 4)).toBe(0);
    expect(nextTabIndex(0, "ArrowLeft", 4)).toBe(3);
  });

  it("supports Home and End", () => {
    expect(nextTabIndex(2, "Home", 4)).toBe(0);
    expect(nextTabIndex(1, "End", 4)).toBe(3);
  });

  it("leaves unrelated keys and empty lists alone", () => {
    expect(nextTabIndex(2, "Tab", 4)).toBe(2);
    expect(nextTabIndex(2, "ArrowRight", 0)).toBe(0);
  });
});
