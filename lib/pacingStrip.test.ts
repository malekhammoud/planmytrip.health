/**
 * Geometry tests for the pure pacing-strip layout.
 *
 * Covers proportional tiling, non-overlap, width clamping, empty input, recovery
 * classification, and the two-hour axis ticks.
 */

import { describe, expect, it } from "vitest";
import type { ItineraryBlock } from "@/lib/healthTripEngine";
import { layoutStrip } from "@/lib/pacingStrip";

function block(
  durationMin: number,
  exertion: ItineraryBlock["exertion"] = 1,
  kind: ItineraryBlock["kind"] = "cultural",
): ItineraryBlock {
  return { kind, label: `${kind} ${durationMin}`, durationMin, exertion };
}

describe("layoutStrip", () => {
  it("tiles the width in proportion to duration", () => {
    const blocks = [block(30), block(90), block(60)];
    const layout = layoutStrip(blocks, { width: 640 });
    expect(layout.totalMinutes).toBe(180);
    expect(layout.rects).toHaveLength(3);
    expect(layout.rects[0].x).toBeCloseTo(0, 9);
    expect(layout.rects[0].width).toBeCloseTo(640 * (30 / 180), 9);
    expect(layout.rects[1].x).toBeCloseTo(640 * (30 / 180), 9);
    expect(layout.rects[1].width).toBeCloseTo(640 * (90 / 180), 9);
    expect(layout.rects[2].x).toBeCloseTo(640 * (120 / 180), 9);
    expect(layout.rects[2].width).toBeCloseTo(640 * (60 / 180), 9);
    const totalWidth = layout.rects.reduce((sum, rect) => sum + rect.width, 0);
    expect(totalWidth).toBeCloseTo(640, 9);
    for (const rect of layout.rects) {
      expect(rect.width / 640).toBeCloseTo(rect.durationMin / 180, 9);
    }
  });

  it("never overlaps and never exceeds the width", () => {
    const blocks = [block(20), block(0), block(45), block(15), block(90)];
    const layout = layoutStrip(blocks, { width: 640 });
    let previousEnd = 0;
    for (const rect of layout.rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(640 + 1e-9);
      expect(rect.x).toBeGreaterThanOrEqual(previousEnd - 1e-9);
      previousEnd = rect.x + rect.width;
    }
    expect(previousEnd).toBeCloseTo(640, 9);
  });

  it("matches the total rect width to the total duration", () => {
    const layout = layoutStrip([block(35), block(85), block(40)], {
      width: 517.3,
    });
    const totalWidth = layout.rects.reduce((sum, rect) => sum + rect.width, 0);
    expect(totalWidth).toBeCloseTo(layout.width, 9);
    expect(layout.totalMinutes).toBe(160);
  });

  it("handles empty input", () => {
    expect(layoutStrip([], { width: 640 })).toEqual({
      width: 640,
      totalMinutes: 0,
      rects: [],
      ticks: [],
    });
  });

  it("handles a non-positive width", () => {
    const layout = layoutStrip([block(30)], { width: 0 });
    expect(layout.width).toBe(0);
    expect(layout.rects).toEqual([]);
    expect(layout.ticks).toEqual([]);
  });

  it("classifies recovery separately and keeps exertion", () => {
    const layout = layoutStrip(
      [block(30, 1, "recovery"), block(15, 2, "transit")],
      { width: 320 },
    );
    expect(layout.rects.map((rect) => rect.kind)).toEqual(["recovery", "exertion"]);
    expect(layout.rects.map((rect) => rect.exertion)).toEqual([1, 2]);
  });

  it("places axis ticks every two hours from the start hour", () => {
    const layout = layoutStrip([block(120), block(120)], {
      width: 640,
      startHour: 9,
    });
    expect(layout.ticks.map((tick) => tick.label)).toEqual([
      "09:00",
      "11:00",
      "13:00",
    ]);
    expect(layout.ticks.map((tick) => tick.position)).toEqual([0, 0.5, 1]);
    expect(layout.ticks.map((tick) => tick.anchor)).toEqual([
      "start",
      "center",
      "end",
    ]);
  });

  it("omits ticks after the modeled day ends", () => {
    const layout = layoutStrip([block(200)], { width: 640, startHour: 8 });
    expect(layout.ticks.map((tick) => tick.label)).toEqual(["08:00", "10:00"]);
    expect(layout.ticks.map((tick) => tick.anchor)).toEqual(["start", "center"]);
    expect(layout.ticks[1].position).toBeCloseTo(0.6, 9);
  });

  it("anchors a final tick inward before it can overflow", () => {
    const layout = layoutStrip([block(130)], { width: 640, startHour: 8 });
    expect(layout.ticks.map((tick) => tick.position)).toEqual([0, 120 / 130]);
    expect(layout.ticks.map((tick) => tick.anchor)).toEqual(["start", "end"]);
  });

  it("returns no ticks for a zero-length day", () => {
    const layout = layoutStrip([block(0)], { width: 640 });
    expect(layout.totalMinutes).toBe(0);
    expect(layout.rects[0].width).toBe(0);
    expect(layout.ticks).toEqual([]);
  });
});
