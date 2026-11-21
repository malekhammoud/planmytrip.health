/**
 * Open-path visit ordering for one day.
 *
 * Inputs: the day's base point (the stay, or null) and the day's stops in the order the
 * concierge listed them. Outputs: the same stops in a shorter visiting order.
 * Invariants: deterministic for identical input; the first stop is the nearest neighbour of
 * the base; only strict length improvements are accepted, so equal-length ties keep the
 * earlier order. This is an open path: the day starts at the base and ends at the last stop,
 * and the return to the base is the traveler's own choice, not part of the modeled distance.
 *
 * Algorithm: nearest-neighbour seed, then 2-opt segment reversal, then Or-opt segment
 * relocation, each with a bounded number of improvement passes. For n stops the seed is
 * O(n^2) and each pass is O(n^3) in the worst case with n at most 32, which is well under a
 * millisecond and avoids shipping a solver dependency.
 */

import { haversineKm, pathLengthKm } from "./geometry";
import type { GeoPoint } from "./routeTypes";

/** Minimum shape the optimizer needs from a stop. */
export interface OptimizerStop extends GeoPoint {
  id: string;
}

/** Improvement tolerance, about a millimetre per leg; avoids float churn. */
const EPSILON_KM = 1e-9;

export function openPathLengthKm(
  base: GeoPoint | null,
  stops: readonly GeoPoint[],
): number {
  return base === null ? pathLengthKm(stops) : pathLengthKm([base, ...stops]);
}

/**
 * Greedy nearest-neighbour seed. Ties break on the stable id so the result never depends on
 * array order for equidistant stops.
 */
export function nearestNeighbourOrder(
  base: GeoPoint | null,
  stops: readonly OptimizerStop[],
): OptimizerStop[] {
  if (stops.length === 0) return [];
  const remaining = [...stops];
  const ordered: OptimizerStop[] = [];
  // Without a base, the first stop in the caller's order becomes the anchor. That keeps a
  // day starting where the plan says it starts instead of at an arbitrary nearest point.
  if (base === null) ordered.push(remaining.shift() as OptimizerStop);
  let cursor: GeoPoint | null = base ?? ordered[0];
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = cursor === null ? 0 : haversineKm(cursor, candidate);
      const closer = distance < bestDistance - EPSILON_KM;
      const tiedAndEarlier =
        Math.abs(distance - bestDistance) <= EPSILON_KM &&
        candidate.id < remaining[bestIndex].id;
      if (closer || tiedAndEarlier) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    cursor = next;
  }
  return ordered;
}

/**
 * 2-opt: reverses one segment at a time and keeps the reversal when the open path shortens.
 * Bounded passes keep the worst case flat for the largest plan.
 */
export function improveWithTwoOpt(
  base: GeoPoint | null,
  stops: readonly OptimizerStop[],
  passes = 4,
): OptimizerStop[] {
  let best = [...stops];
  let bestLength = openPathLengthKm(base, best);
  for (let pass = 0; pass < passes; pass += 1) {
    const snapshot = [...best];
    let improved = false;
    for (let start = 0; start < snapshot.length - 1; start += 1) {
      for (let end = start + 1; end < snapshot.length; end += 1) {
        const candidate = [
          ...snapshot.slice(0, start),
          ...snapshot.slice(start, end + 1).reverse(),
          ...snapshot.slice(end + 1),
        ];
        const length = openPathLengthKm(base, candidate);
        if (length < bestLength - EPSILON_KM) {
          best = candidate;
          bestLength = length;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

/**
 * Or-opt: relocates a one- or two-stop segment elsewhere in the path. It catches the
 * "move one stop across the day" improvement that segment reversal cannot express.
 */
export function improveWithOrOpt(
  base: GeoPoint | null,
  stops: readonly OptimizerStop[],
  passes = 3,
): OptimizerStop[] {
  let best = [...stops];
  let bestLength = openPathLengthKm(base, best);
  for (let pass = 0; pass < passes; pass += 1) {
    const snapshot = [...best];
    let improved = false;
    for (let segmentLength = 1; segmentLength <= 2; segmentLength += 1) {
      for (let start = 0; start + segmentLength <= snapshot.length; start += 1) {
        const segment = snapshot.slice(start, start + segmentLength);
        const rest = [
          ...snapshot.slice(0, start),
          ...snapshot.slice(start + segmentLength),
        ];
        for (let insert = 0; insert <= rest.length; insert += 1) {
          if (insert === start) continue;
          const candidate = [
            ...rest.slice(0, insert),
            ...segment,
            ...rest.slice(insert),
          ];
          const length = openPathLengthKm(base, candidate);
          if (length < bestLength - EPSILON_KM) {
            best = candidate;
            bestLength = length;
            improved = true;
          }
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

/**
 * Full ordering pipeline. With no base, the concierge's first stop stays first and the rest
 * are ordered from it, so the day still begins where the plan says it begins.
 */
export function orderStops(
  base: GeoPoint | null,
  stops: readonly OptimizerStop[],
): OptimizerStop[] {
  if (stops.length <= 1) return [...stops];
  // With no base, the first stop anchors the path; measure improvements from it too, or the
  // first leg would be missing from every length comparison.
  const anchor: GeoPoint = base ?? stops[0];
  const seeded = nearestNeighbourOrder(anchor, stops);
  return improveWithOrOpt(anchor, improveWithTwoOpt(anchor, seeded));
}
