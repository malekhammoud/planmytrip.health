import { describe, expect, it } from "vitest";
import { centroid, haversineKm, pathLengthKm, roundKm } from "./geometry";

const LISBON = { lat: 38.7223, lng: -9.1393 };
const PORTO = { lat: 41.1579, lng: -8.6291 };

describe("haversineKm", () => {
  it("measures one degree of longitude at the equator", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19, 1);
  });

  it("matches a known city pair", () => {
    const km = haversineKm(LISBON, PORTO);
    expect(km).toBeGreaterThan(260);
    expect(km).toBeLessThan(290);
  });

  it("is symmetric and zero for a point against itself", () => {
    expect(haversineKm(LISBON, PORTO)).toBeCloseTo(haversineKm(PORTO, LISBON), 9);
    expect(haversineKm(LISBON, LISBON)).toBe(0);
  });

  it("handles antipodal points without domain errors", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20015, 0);
  });
});

describe("pathLengthKm", () => {
  it("adds the legs in order", () => {
    const path = pathLengthKm([LISBON, PORTO]);
    expect(path).toBeCloseTo(haversineKm(LISBON, PORTO), 9);
  });

  it("is zero for an empty or single-point path", () => {
    expect(pathLengthKm([])).toBe(0);
    expect(pathLengthKm([LISBON])).toBe(0);
  });
});

describe("roundKm", () => {
  it("rounds to ten metres", () => {
    expect(roundKm(1.2345)).toBe(1.23);
    expect(roundKm(0.005)).toBe(0.01);
  });
});

describe("centroid", () => {
  it("averages the points", () => {
    expect(centroid([{ lat: 0, lng: 0 }, { lat: 2, lng: 4 }])).toEqual({ lat: 1, lng: 2 });
  });

  it("returns null for no points", () => {
    expect(centroid([])).toBeNull();
  });
});
