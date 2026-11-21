import { describe, expect, it } from "vitest";
import { fitLogistic, zeroFit } from "./logistic";
import { sigmoid } from "./math";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("fitLogistic", () => {
  it("recovers known coefficients from synthetic labels", () => {
    const random = mulberry32(42);
    const design: number[][] = [];
    const labels: number[] = [];
    for (let index = 0; index < 3_000; index += 1) {
      const x1 = random() * 2 - 1;
      const x2 = random() * 2 - 1;
      const probability = sigmoid(0.3 + 1.2 * x1 - 0.8 * x2);
      design.push([1, x1, x2]);
      labels.push(random() < probability ? 1 : 0);
    }
    const fit = fitLogistic(
      design,
      labels,
      new Array<number>(design.length).fill(0),
      [10, 10, 10],
    );
    expect(fit.beta[0]).toBeCloseTo(0.3, 1);
    expect(Math.abs(fit.beta[1] - 1.2)).toBeLessThan(0.15);
    expect(Math.abs(fit.beta[2] + 0.8)).toBeLessThan(0.15);
    expect(fit.covariance).toHaveLength(3);
  });

  it("keeps a zero fit at the engine offset", () => {
    const fit = zeroFit(4);
    expect(fit.beta).toEqual([0, 0, 0, 0]);
    expect(fit.covariance[0][0]).toBe(1);
  });
});
