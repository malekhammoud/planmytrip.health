import { describe, expect, it } from "vitest";
import {
  candidateUrl,
  parseVenueEvidence,
  parseVenueEvidenceList,
  parseVenueResearchRequest,
} from "./types";

const menu = {
  kind: "menu",
  placeId: "place-1",
  placeName: "Cafe",
  sourceUrl: "https://example.com/menu",
  retrievedAt: "2026-11-22T10:00:00.000Z",
  currency: "CAD",
  items: [{ section: "Mains", name: "Soup", price: 12, currency: "CAD", description: null, allergenNotes: "Contains dairy" }],
  notes: ["Menu checked live."],
};

const hotel = {
  kind: "hotel",
  placeId: "place-2",
  placeName: "Hotel",
  sourceUrl: "https://example.com/hotel",
  retrievedAt: "2026-11-22T10:00:00.000Z",
  checkIn: "2026-12-10",
  checkOut: "2026-12-14",
  travelers: 2,
  roomType: "King",
  nightlyRate: 189,
  total: 756,
  taxesAndFees: 80,
  currency: "CAD",
  cancellation: "Free until 48 hours before",
  bookingUrl: "https://example.com/book",
  notes: [],
};

describe("venue contracts", () => {
  it("reads menu and hotel evidence", () => {
    expect(parseVenueEvidence(menu)?.kind).toBe("menu");
    expect(parseVenueEvidence(hotel)?.kind).toBe("hotel");
    expect(parseVenueEvidenceList([menu, hotel])).toHaveLength(2);
  });

  it("rejects an invalid hotel date or party size", () => {
    expect(parseVenueEvidence({ ...hotel, checkIn: "2026-02-30" })).toBeNull();
    expect(parseVenueEvidence({ ...hotel, travelers: 0 })).toBeNull();
  });

  it("validates a venue request and selects candidate URLs", () => {
    const request = parseVenueResearchRequest({
      destination: "London, Ontario",
      checkIn: "2026-12-10",
      days: 4,
      travelers: 2,
      places: [
        {
          id: "place-1",
          name: "Cafe",
          category: "eat",
          sourceUrl: "https://example.com/cafe",
          menuUrl: "https://example.com/menu",
        },
        {
          id: "place-2",
          name: "Hotel",
          category: "stay",
          sourceUrl: "https://example.com/hotel",
          bookingUrl: "https://example.com/book",
        },
      ],
    });
    expect(request?.places).toHaveLength(2);
    expect(candidateUrl(request!.places[0]!)).toBe("https://example.com/menu");
    expect(candidateUrl(request!.places[1]!)).toBe("https://example.com/book");
  });

  it("rejects a request without a usable place", () => {
    expect(
      parseVenueResearchRequest({
        destination: "London",
        days: 4,
        places: [{ id: "x", name: "Cafe", category: "eat", sourceUrl: "javascript:bad" }],
      }),
    ).toBeNull();
  });
});
