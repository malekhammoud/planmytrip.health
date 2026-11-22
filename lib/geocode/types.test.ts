/**
 * Geocoder contract tests: bounded labels, coordinate validation, and kind copy.
 */

import { describe, expect, it } from "vitest";
import {
  describePlaceKind,
  parseGeocodePlace,
  parseGeocodePlaceResponse,
  parseGeocodeResults,
} from "./types";

const valid = {
  label: "London, Ontario, Canada",
  cityLabel: "London, Ontario, Canada",
  name: "London",
  city: "London",
  region: "Ontario",
  country: "Canada",
  lat: 42.9849,
  lng: -81.2453,
  kind: "city",
};

describe("geocode contracts", () => {
  it("reads a valid place", () => {
    expect(parseGeocodePlace(valid)).toMatchObject({
      label: "London, Ontario, Canada",
      lat: 42.9849,
      lng: -81.2453,
    });
  });

  it("drops a coordinate outside the map and a missing label", () => {
    expect(parseGeocodePlace({ ...valid, lat: 100 })).toBeNull();
    expect(parseGeocodePlace({ ...valid, label: "   " })).toBeNull();
  });

  it("reads at most eight results and skips malformed rows", () => {
    const results = Array.from({ length: 10 }, (_, index) => ({
      ...valid,
      label: `City ${index}`,
    }));
    expect(parseGeocodeResults({ results })).toHaveLength(8);
    expect(parseGeocodeResults({ results: [null, valid] })).toHaveLength(1);
    expect(parseGeocodeResults({})).toEqual([]);
  });

  it("reads a reverse response", () => {
    expect(parseGeocodePlaceResponse({ place: valid })?.name).toBe("London");
    expect(parseGeocodePlaceResponse({ place: null })).toBeNull();
  });

  it("humanises provider kinds", () => {
    expect(describePlaceKind("city")).toBe("City");
    expect(describePlaceKind("house")).toBe("Address");
    expect(describePlaceKind("locality")).toBe("Area");
    expect(describePlaceKind("bed_and_breakfast")).toBe("Bed And Breakfast");
    expect(describePlaceKind(null)).toBeNull();
  });
});
