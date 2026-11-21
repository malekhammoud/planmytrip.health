import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatOffset,
  formatRetrievedAt,
  hostOf,
  missionWorkers,
} from "./missionMeta";

describe("missionMeta", () => {
  it("keeps the canonical worker order", () => {
    expect(missionWorkers()).toEqual(["advisory", "pharmacy", "coverage"]);
  });

  it("formats durations and offsets without locale output", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(42_000)).toBe("00:42");
    expect(formatDuration(3_723_000)).toBe("1:02:03");
    expect(formatOffset(12_000, 0)).toBe("+00:12");
    expect(formatOffset(5_000, 12_000)).toBe("+00:00");
  });

  it("reads hosts from absolute URLs only", () => {
    expect(hostOf("https://travel.gc.ca/travelling/advisories")).toBe("travel.gc.ca");
    expect(hostOf("/mock-browser/advisory", "travel.gc.ca")).toBe("travel.gc.ca");
    expect(hostOf(null, "travel.gc.ca")).toBe("travel.gc.ca");
    expect(hostOf(undefined)).toBe("No URL");
  });

  it("formats retrieved times in UTC or Not found", () => {
    expect(formatRetrievedAt("2026-11-21T12:34:56.000Z")).toBe("2026-11-21 12:34 UTC");
    expect(formatRetrievedAt(null)).toBe("Not found");
    expect(formatRetrievedAt("nonsense")).toBe("Not found");
  });
});
