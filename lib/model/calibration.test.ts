import { describe, expect, it } from "vitest";
import {
  applyIsotonic,
  auroc,
  brierScore,
  expectedCalibrationError,
  fitIsotonic,
} from "./calibration";

describe("fitIsotonic", () => {
  it("pools adjacent violators into a non-decreasing curve", () => {
    const points = [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.5 },
      { x: 0.3, y: 0.2 },
      { x: 0.4, y: 0.6 },
    ];
    const curve = fitIsotonic(points);
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index].y).toBeGreaterThanOrEqual(curve[index - 1].y);
    }
  });

  it("returns a flat curve for constant labels", () => {
    const curve = fitIsotonic([
      { x: 0.2, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.9, y: 0 },
    ]);
    expect(curve.every((point) => point.y === 0)).toBe(true);
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index].y).toBeGreaterThanOrEqual(curve[index - 1].y);
    }
  });

  it("interpolates between knots and clamps at the ends", () => {
    const curve = fitIsotonic([
      { x: 0.2, y: 0.1 },
      { x: 0.8, y: 0.5 },
    ]);
    expect(applyIsotonic(curve, 0.1)).toBeCloseTo(0.1, 6);
    expect(applyIsotonic(curve, 0.5)).toBeCloseTo(0.3, 6);
    expect(applyIsotonic(curve, 0.9)).toBeCloseTo(0.5, 6);
  });
});

describe("metrics", () => {
  it("scores a perfect prediction at zero Brier and log loss", () => {
    const labels = [0, 1, 1, 0];
    const probabilities = [0, 1, 1, 0];
    expect(brierScore(labels, probabilities)).toBe(0);
    expect(expectedCalibrationError(labels, probabilities)).toBe(0);
    expect(auroc(labels, probabilities)).toBe(1);
  });

  it("returns 0.5 AUROC when one class is missing", () => {
    expect(auroc([0, 0, 0], [0.2, 0.4, 0.6])).toBe(0.5);
  });
});
