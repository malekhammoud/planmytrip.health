import { describe, expect, it } from "vitest";
import { metricBarWidths } from "./metricBars";

describe("metricBarWidths", () => {
  it("fills both bars when the values are equal", () => {
    expect(metricBarWidths(30, 30)).toEqual({ thisPlan: 100, baseline: 100 });
  });

  it("scales against the larger plan value", () => {
    expect(metricBarWidths(30, 15)).toEqual({ thisPlan: 100, baseline: 50 });
  });

  it("scales against the larger baseline value", () => {
    expect(metricBarWidths(15, 30)).toEqual({ thisPlan: 50, baseline: 100 });
  });

  it("returns zero widths for an empty comparison", () => {
    expect(metricBarWidths(0, 0)).toEqual({ thisPlan: 0, baseline: 0 });
  });

  it("treats negative values as zero", () => {
    expect(metricBarWidths(-5, 10)).toEqual({ thisPlan: 0, baseline: 100 });
  });

  it("treats non-finite values as zero", () => {
    expect(metricBarWidths(Number.NaN, 10)).toEqual({ thisPlan: 0, baseline: 100 });
  });
});
