import { describe, expect, it } from "vitest";
import {
  buildArrivalMapUrl,
  buildDayMapUrl,
  MAPS_MAX_WAYPOINTS,
  mapsTravelModeFor,
  mapsTravelModeForLeg,
} from "./mapsLink";

const BASE = { lat: 1, lng: 2 };

function points(count: number): { lat: number; lng: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: 3 + index,
    lng: 4 + index,
  }));
}

describe("mapsTravelModeFor", () => {
  it("maps each transport preference to a Maps mode", () => {
    expect(mapsTravelModeFor("walk")).toBe("walking");
    expect(mapsTravelModeFor("transit")).toBe("transit");
    expect(mapsTravelModeFor("car")).toBe("driving");
    expect(mapsTravelModeFor("mixed")).toBe("driving");
  });

  it("maps resolved leg modes", () => {
    expect(mapsTravelModeForLeg("walk")).toBe("walking");
    expect(mapsTravelModeForLeg("transit")).toBe("transit");
    expect(mapsTravelModeForLeg("car")).toBe("driving");
  });
});

describe("buildDayMapUrl", () => {
  it("builds a loop from the base back to the base", () => {
    const link = buildDayMapUrl({
      base: BASE,
      stops: points(2),
      travelMode: "walking",
    });
    expect(link.truncated).toBe(false);
    expect(link.url).toBe(
      "https://www.google.com/maps/dir/?api=1" +
        "&origin=1.000000%2C2.000000" +
        "&destination=1.000000%2C2.000000" +
        "&waypoints=3.000000%2C4.000000%7C4.000000%2C5.000000" +
        "&travelmode=walking" +
        "&dir_action=navigate",
    );
  });

  it("caps the waypoint list and reports truncation", () => {
    const link = buildDayMapUrl({
      base: BASE,
      stops: points(MAPS_MAX_WAYPOINTS + 3),
      travelMode: "driving",
    });
    expect(link.truncated).toBe(true);
    const waypoints = new URL(link.url as string).searchParams.get("waypoints");
    expect(waypoints?.split("|")).toHaveLength(MAPS_MAX_WAYPOINTS);
  });

  it("keeps exactly the limit without reporting truncation", () => {
    const link = buildDayMapUrl({
      base: BASE,
      stops: points(MAPS_MAX_WAYPOINTS),
      travelMode: "transit",
    });
    expect(link.truncated).toBe(false);
  });

  it("returns no link for a base with no stops", () => {
    expect(buildDayMapUrl({ base: BASE, stops: [], travelMode: "walking" })).toEqual({
      url: null,
      truncated: false,
    });
  });

  it("uses an open path when the day has no base", () => {
    const link = buildDayMapUrl({
      base: null,
      stops: points(3),
      travelMode: "driving",
    });
    const url = new URL(link.url as string);
    expect(url.searchParams.get("origin")).toBe("3.000000,4.000000");
    expect(url.searchParams.get("destination")).toBe("5.000000,6.000000");
    expect(url.searchParams.get("waypoints")).toBe("4.000000,5.000000");
  });

  it("needs two stops for a base-less day", () => {
    expect(buildDayMapUrl({ base: null, stops: points(1), travelMode: "walking" })).toEqual({
      url: null,
      truncated: false,
    });
  });
});

describe("buildArrivalMapUrl", () => {
  it("encodes free-text labels", () => {
    const url = buildArrivalMapUrl({
      origin: "Toronto, ON",
      destination: "Hotel A",
      travelMode: "driving",
    });
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1" +
        "&origin=Toronto%2C%20ON" +
        "&destination=Hotel%20A" +
        "&travelmode=driving" +
        "&dir_action=navigate",
    );
  });

  it("returns null when either label is missing", () => {
    expect(
      buildArrivalMapUrl({ origin: "  ", destination: "Hotel A", travelMode: "driving" }),
    ).toBeNull();
    expect(
      buildArrivalMapUrl({ origin: "Toronto", destination: "", travelMode: "driving" }),
    ).toBeNull();
  });
});
