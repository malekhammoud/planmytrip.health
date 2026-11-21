import { describe, expect, it } from "vitest";
import {
  improveWithOrOpt,
  improveWithTwoOpt,
  nearestNeighbourOrder,
  openPathLengthKm,
  orderStops,
  type OptimizerStop,
} from "./optimizer";

const BASE = { lat: 0, lng: 0 };

function stop(id: string, lng: number): OptimizerStop {
  return { id, lat: 0, lng };
}

/** The concierge listed the day backwards: far stop first, near stop last. */
const BACKWARDS = [stop("c", 0.03), stop("a", 0.01), stop("b", 0.02)];

describe("nearestNeighbourOrder", () => {
  it("walks outwards from the base", () => {
    expect(nearestNeighbourOrder(BASE, BACKWARDS).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps the caller's first stop when there is no base", () => {
    expect(nearestNeighbourOrder(null, BACKWARDS)[0].id).toBe("c");
  });

  it("returns an empty list for no stops", () => {
    expect(nearestNeighbourOrder(BASE, [])).toEqual([]);
  });
});

describe("improveWithTwoOpt", () => {
  it("reverses the backwards day into a forward one", () => {
    expect(improveWithTwoOpt(BASE, BACKWARDS).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("never lengthens the path", () => {
    const before = openPathLengthKm(BASE, BACKWARDS);
    const after = openPathLengthKm(BASE, improveWithTwoOpt(BASE, BACKWARDS));
    expect(after).toBeLessThanOrEqual(before);
  });

  it("leaves an already ordered path alone", () => {
    const ordered = [stop("a", 0.01), stop("b", 0.02), stop("c", 0.03)];
    expect(improveWithTwoOpt(BASE, ordered).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("improveWithOrOpt", () => {
  it("does not lengthen the path", () => {
    const before = openPathLengthKm(BASE, BACKWARDS);
    const after = openPathLengthKm(BASE, improveWithOrOpt(BASE, BACKWARDS));
    expect(after).toBeLessThanOrEqual(before);
  });
});

describe("orderStops", () => {
  it("produces a shorter path than the plan order", () => {
    const before = openPathLengthKm(BASE, BACKWARDS);
    const ordered = orderStops(BASE, BACKWARDS);
    const after = openPathLengthKm(BASE, ordered);
    expect(after).toBeLessThan(before);
    expect(ordered.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("is deterministic for identical input", () => {
    const first = orderStops(BASE, BACKWARDS).map((item) => item.id);
    const second = orderStops(BASE, BACKWARDS).map((item) => item.id);
    expect(second).toEqual(first);
  });

  it("keeps every stop exactly once", () => {
    const ids = orderStops(BASE, BACKWARDS).map((item) => item.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("optimizes a two-stop day instead of trusting the plan order", () => {
    expect(orderStops(BASE, [stop("b", 0.02), stop("a", 0.01)]).map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("handles an empty or single-stop day", () => {
    expect(orderStops(BASE, [])).toEqual([]);
    expect(orderStops(BASE, [stop("a", 0.01)]).map((item) => item.id)).toEqual(["a"]);
  });

  it("anchors a base-less day at the plan's first stop", () => {
    expect(orderStops(null, BACKWARDS)[0].id).toBe("c");
  });

  it("orders a two-dimensional cluster by proximity", () => {
    const cluster = [
      { id: "far", lat: 0.1, lng: 0.1 },
      { id: "near", lat: 0.005, lng: 0.004 },
      { id: "middle", lat: 0.05, lng: 0.05 },
    ];
    expect(orderStops(BASE, cluster).map((item) => item.id)).toEqual([
      "near",
      "middle",
      "far",
    ]);
  });
});
