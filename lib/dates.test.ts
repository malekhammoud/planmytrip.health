import { describe, expect, it } from "vitest";
import { addDaysIso, isIsoDate } from "./dates";

describe("ISO dates", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2026-12-10")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("10/12/2026")).toBe(false);
  });

  it("adds nights across a month boundary", () => {
    expect(addDaysIso("2026-12-28", 5)).toBe("2027-01-02");
    expect(addDaysIso("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysIso("not-a-date", 2)).toBeNull();
  });
});
