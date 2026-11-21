/**
 * Stop collection and slotting for one route day.
 *
 * Inputs: a concierge day, its places, and the day's base.
 * Outputs: the day's routable stops in visited order.
 * Invariants: a stop exists only with verified coordinates; a duplicated place appears once; a
 * check-in at the day's own base is not a stop; pinned slots never move, so a dinner cannot be
 * reordered into breakfast.
 */

import type { PlannerDay, PlannerPlace } from "../agent/agentTypes";
import { orderStops } from "./optimizer";
import type { GeoPoint, RouteStop } from "./routeTypes";

/** A place is routable only when both coordinates survived normalisation. */
export type MappedPlace = PlannerPlace & { lat: number; lng: number };

/** True when a place carries both coordinates. */
export function isMapped(place: PlannerPlace): place is MappedPlace {
  return place.lat !== null && place.lng !== null;
}

/** The day's anchor: its own referenced stay first, then the trip's first mapped stay. */
export function baseForDay(
  day: PlannerDay,
  stays: readonly MappedPlace[],
  fallback: MappedPlace | null,
): { placeId: string; name: string; point: GeoPoint } | null {
  const referenced = stays.find((stay) =>
    day.blocks.some((block) => block.placeId === stay.id),
  );
  const chosen = referenced ?? fallback;
  if (chosen === undefined || chosen === null) return null;
  return {
    placeId: chosen.id,
    name: chosen.name,
    point: { lat: chosen.lat, lng: chosen.lng },
  };
}

/** One collected stop plus whether its slot must not move. */
export interface DayStop {
  stop: RouteStop;
  pinned: boolean;
}

/** Collects the day's stops in plan order, skipping the base and every unknown id. */
export function collectStops(
  day: PlannerDay,
  byId: ReadonlyMap<string, MappedPlace>,
  basePlaceId: string | null,
): DayStop[] {
  const stops: DayStop[] = [];
  const seen = new Set<string>();
  for (const block of day.blocks) {
    if (block.placeId === null || seen.has(block.placeId)) continue;
    if (block.placeId === basePlaceId) continue;
    const place = byId.get(block.placeId);
    if (place === undefined) continue;
    seen.add(place.id);
    stops.push({
      pinned: block.kind === "meal" || block.kind === "stay",
      stop: {
        placeId: place.id,
        name: place.name,
        category: place.category,
        lat: place.lat,
        lng: place.lng,
        serviceMin: Math.max(0, Math.round(block.durationMin)),
      },
    });
  }
  return stops;
}

/**
 * Applies the optimized order while keeping pinned slots fixed: each pinned stop stays at its
 * original index and the flexible stops fill the remaining slots in optimized order.
 */
export function sequenceStops(
  items: readonly DayStop[],
  base: GeoPoint | null,
): RouteStop[] {
  if (items.length <= 1) return items.map((item) => item.stop);
  const ordered = orderStops(
    base,
    items.map((item) => ({
      id: item.stop.placeId,
      lat: item.stop.lat,
      lng: item.stop.lng,
    })),
  );
  const pinnedIds = new Set(
    items.filter((item) => item.pinned).map((item) => item.stop.placeId),
  );
  const flexible = ordered
    .filter((point) => !pinnedIds.has(point.id))
    .map((point) => point.id);
  const byId = new Map(items.map((item) => [item.stop.placeId, item.stop]));
  const sequenced: RouteStop[] = [];
  let cursor = 0;
  for (const item of items) {
    if (item.pinned) {
      sequenced.push(item.stop);
      continue;
    }
    const nextId = flexible[cursor];
    cursor += 1;
    sequenced.push(byId.get(nextId ?? "") ?? item.stop);
  }
  return sequenced;
}
