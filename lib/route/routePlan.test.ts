import { describe, expect, it } from "vitest";
import type {
  PlannerDay,
  PlannerDayBlock,
  PlannerPlace,
  PlanBlockKind,
} from "../agent/agentTypes";
import type { TransportMode } from "../types";
import { buildTripRoute, DEMANDING_WALK_RATIO } from "./routePlan";

const BASE_POINT = { lat: 38.72, lng: -9.14 };

function place(
  id: string,
  category: PlannerPlace["category"],
  lat: number | null,
  lng: number | null,
): PlannerPlace {
  return {
    id,
    name: `Place ${id}`,
    category,
    area: "",
    lat,
    lng,
    why: "",
    notes: null,
    priceBand: null,
    durationMin: null,
    nights: null,
    distanceKm: null,
    elevationM: null,
    difficulty: null,
    booking: null,
    sourceUrl: null,
    address: null,
    phone: null,
    careType: null,
    day: null,
  };
}

function block(
  kind: PlanBlockKind,
  placeId: string | null,
  durationMin = 60,
): PlannerDayBlock {
  return { time: "10:00", kind, title: kind, detail: "", durationMin, placeId };
}

function day(
  dayNumber: number,
  blocks: PlannerDayBlock[],
  overrides: Partial<PlannerDay> = {},
): PlannerDay {
  return {
    day: dayNumber,
    title: `Day ${dayNumber}`,
    area: "",
    restDay: false,
    stepEstimate: 0,
    walkingKm: 0,
    recoveryMinutes: 0,
    blocks,
    stepCeiling: 7000,
    walkingCapKm: 4,
    withinCaps: true,
    checkpoint: "",
    ...overrides,
  };
}

function route(days: PlannerDay[], places: PlannerPlace[], transport: TransportMode = "mixed") {
  return buildTripRoute({ days, places, transport, origin: "" });
}

const STAY = place("s", "stay", BASE_POINT.lat, BASE_POINT.lng);
const A = place("a", "visit", 38.72, -9.13);
const B = place("b", "visit", 38.72, -9.12);
const C = place("c", "visit", 38.72, -9.11);

describe("buildTripRoute", () => {
  it("orders a day's stops from the base and connects every leg", () => {
    const trip = route(
      [day(1, [block("visit", "c"), block("visit", "a"), block("visit", "b")])],
      [STAY, A, B, C],
    );
    const first = trip.days[0];
    expect(first.stops.map((stop) => stop.placeId)).toEqual(["a", "b", "c"]);
    expect(first.base?.name).toBe("Place s");
    expect(first.legs).toHaveLength(3);
    expect(first.legs[0].from).toBe("base");
    expect(first.totals.distanceKm).toBeGreaterThan(2);
    expect(first.totals.onSiteMin).toBe(180);
    expect(first.mapUrl).toContain("https://www.google.com/maps/dir/?api=1");
    expect(first.mapUrl).toContain("travelmode=walking");
  });

  it("uses a place's own block duration as its time on site", () => {
    const trip = route(
      [day(1, [block("visit", "a", 45), block("meal", "b", 90)])],
      [STAY, A, B],
    );
    expect(trip.days[0].stops.find((stop) => stop.placeId === "a")?.serviceMin).toBe(45);
    expect(trip.days[0].totals.onSiteMin).toBe(135);
  });

  it("keeps a meal in its slot while reordering the rest", () => {
    const dinner = place("d", "eat", 38.72, -9.135);
    const trip = route(
      [day(1, [block("visit", "c"), block("visit", "a"), block("meal", "d")])],
      [STAY, A, C, dinner],
    );
    const ids = trip.days[0].stops.map((stop) => stop.placeId);
    expect(ids[ids.length - 1]).toBe("d");
    expect(ids.slice(0, 2).sort()).toEqual(["a", "c"]);
  });

  it("does not route to the day's own base as a stop", () => {
    const trip = route(
      [day(1, [block("stay", "s", 45), block("visit", "a")])],
      [STAY, A],
    );
    expect(trip.days[0].stops.map((stop) => stop.placeId)).toEqual(["a"]);
    expect(trip.days[0].legs).toHaveLength(1);
  });

  it("drops unmapped places instead of inventing a coordinate", () => {
    const unmapped = place("u", "visit", null, null);
    const trip = route([day(1, [block("visit", "u")])], [STAY, unmapped]);
    expect(trip.days[0].stops).toEqual([]);
    expect(trip.days[0].mapUrl).toBeNull();
    expect(trip.warnings.map((warning) => warning.code)).toContain("no_coordinates");
  });

  it("warns when two demanding days are back to back", () => {
    const hike = place("h", "hike", 38.72, -9.1);
    const second = place("h2", "hike", 38.72, -9.09);
    const trip = route(
      [
        day(1, [block("hike", "h", 120)]),
        day(2, [block("hike", "h2", 120)]),
      ],
      [STAY, hike, second],
    );
    expect(trip.days[0].demanding).toBe(true);
    expect(trip.days[1].demanding).toBe(true);
    const warning = trip.warnings.find((item) => item.code === "pacing_adjacent");
    expect(warning?.day).toBe(2);
    expect(warning?.message).toContain("Day 2");
  });

  it("marks a day demanding at the walking ratio even without a hike", () => {
    const cap = 1;
    const walker = place("w", "visit", 38.72, -9.138);
    const trip = route(
      [day(1, [block("visit", "w", 480)], { walkingCapKm: cap })],
      [STAY, walker],
    );
    expect(trip.days[0].demanding).toBe(true);
    expect(DEMANDING_WALK_RATIO).toBeLessThan(1);
  });

  it("flags route walking above the day ceiling", () => {
    const trip = route(
      [day(1, [block("visit", "a")], { walkingCapKm: 0.5 })],
      [STAY, A],
      "walk",
    );
    expect(trip.days[0].totals.walkKm).toBeGreaterThan(0.5);
    expect(trip.warnings.map((warning) => warning.code)).toContain("walking_over_cap");
  });

  it("uses a car on a demanding day when the traveler allows one", () => {
    const far = place("f", "hike", 0, 0.0135);
    const base = place("s2", "stay", 0, 0);
    const trip = route([day(1, [block("hike", "f", 90)])], [base, far], "car");
    expect(trip.days[0].legs[0].mode).toBe("car");
    expect(trip.days[0].totals.walkKm).toBe(0);
  });

  it("keeps walking on a demanding walking trip", () => {
    const far = place("f", "hike", 0, 0.0135);
    const base = place("s2", "stay", 0, 0);
    const trip = route([day(1, [block("hike", "f", 90)])], [base, far], "walk");
    expect(trip.days[0].legs[0].mode).toBe("walk");
    expect(trip.days[0].totals.walkKm).toBeGreaterThan(0);
  });

  it("builds the arrival link from the origin to the base", () => {
    const trip = buildTripRoute({
      days: [day(1, [block("visit", "a")])],
      places: [STAY, A],
      transport: "car",
      origin: "Toronto, ON",
    });
    expect(trip.mapUrl).toContain("origin=Toronto%2C%20ON");
    expect(trip.mapUrl).toContain("destination=38.72%2C-9.14");
    expect(trip.mapUrl).toContain("travelmode=driving");
  });

  it("has no arrival link without an origin or a base", () => {
    const trip = route([day(1, [block("visit", "a")])], [STAY, A]);
    expect(trip.mapUrl).toBeNull();
  });

  it("reports a truncated map link at the waypoint limit", () => {
    const many = Array.from({ length: 11 }, (_, index) =>
      place(`p${index}`, "visit", 38.72, -9.13 + index * 0.001),
    );
    const blocks = many.map((item) => block("visit", item.id));
    const trip = route([day(1, blocks)], [STAY, ...many]);
    expect(trip.days[0].stops).toHaveLength(11);
    expect(trip.warnings.map((warning) => warning.code)).toContain("truncated_link");
    const url = new URL(trip.days[0].mapUrl as string);
    expect(url.searchParams.get("waypoints")?.split("|")).toHaveLength(9);
  });

  it("aggregates the trip totals from the days", () => {
    const trip = route(
      [
        day(1, [block("visit", "a"), block("meal", "b")]),
        day(2, [block("visit", "c")]),
      ],
      [STAY, A, B, C],
      "car",
    );
    expect(trip.totals.onSiteMin).toBe(180);
    expect(trip.days).toHaveLength(2);
    expect(trip.totals.distanceKm).toBeCloseTo(
      trip.days.reduce((sum, item) => sum + item.totals.distanceKm, 0),
      2,
    );
  });

  it("keeps a rest day with no stops routable", () => {
    const trip = route(
      [day(1, [block("rest", null, 90)], { restDay: true })],
      [STAY],
    );
    expect(trip.days[0].restDay).toBe(true);
    expect(trip.days[0].stops).toEqual([]);
    expect(trip.days[0].warnings[0].code).toBe("no_coordinates");
  });
});
