import { describe, expect, it } from "vitest";
import {
  checkTitle,
  formatCheckedDate,
  formatDuration,
  formatOffset,
  formatRetrievedAt,
  hostOf,
  missionWorkers,
} from "./missionMeta";

describe("missionMeta", () => {
  it("keeps the canonical worker order", () => {
    expect(missionWorkers()).toEqual(["advisory"]);
  });

  it("names the page being checked without provider copy", () => {
    expect(checkTitle("idle", "travel.gc.ca")).toBe("Not checked yet");
    expect(checkTitle("queued", "travel.gc.ca")).toBe("Preparing travel.gc.ca");
    expect(checkTitle("running", "travel.gc.ca")).toBe("Checking travel.gc.ca");
    expect(checkTitle("complete", "travel.gc.ca")).toBe("Checked travel.gc.ca");
    expect(checkTitle("error", "travel.gc.ca")).toBe("Could not check travel.gc.ca");
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

  it("formats a cache timestamp as a short checked date", () => {
    expect(formatCheckedDate("2026-11-21T12:34:56.000Z")).toBe("21 Nov 2026");
    expect(formatCheckedDate(null)).toBe("Not found");
    expect(formatCheckedDate("nonsense")).toBe("Not found");
  });
});
