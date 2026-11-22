import { describe, expect, it } from "vitest";
import {
  checkedStamp,
  displayOffset,
  evidenceSummary,
  formatClock,
  formatMoney,
  menuPriceRange,
  menuSections,
} from "./format";
import type { MenuEvidence, VenueMenuItem } from "./types";

const items: VenueMenuItem[] = [
  {
    section: "Coffee",
    name: "Latte",
    description: null,
    price: 5,
    currency: "CAD",
    allergenNotes: null,
  },
  {
    section: "Coffee",
    name: "Mocha",
    description: null,
    price: 8.5,
    currency: "CAD",
    allergenNotes: "Contains milk",
  },
  {
    section: null,
    name: "Soup",
    description: null,
    price: 5,
    currency: "CAD",
    allergenNotes: null,
  },
];

const menu: MenuEvidence = {
  kind: "menu",
  placeId: "place-1",
  placeName: "Cafe",
  sourceUrl: "https://example.com/menu",
  retrievedAt: "2026-11-22T06:57:00.000Z",
  currency: "CAD",
  items,
  notes: [],
};

describe("venue format helpers", () => {
  it("formats money and an explicit checked stamp", () => {
    expect(formatMoney(189, "CAD")).toBe("$189.00");
    expect(formatMoney(null, "CAD")).toBe("Not stated");
    expect(checkedStamp("2026-11-22T06:57:00.000Z")).toBe("Nov 22, 2026 · 06:57 UTC");
  });

  it("formats clocks and recorded offsets", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(75)).toBe("01:15");
    expect(formatClock(3_723)).toBe("1:02:03");
    expect(displayOffset("2026-11-22T06:57:00.000Z", null, 12)).toBe("+00:12");
    expect(
      displayOffset("2026-11-22T06:57:00.000Z", "2026-11-22T06:57:30.000Z", null),
    ).toBe("+00:30");
  });

  it("groups menu sections and gives an honest range", () => {
    expect(menuSections(items).map((section) => section.title)).toEqual([
      "Coffee",
      "Menu",
    ]);
    expect(menuPriceRange(items)).toBe("$5.00 to $8.50");
    expect(evidenceSummary(menu)).toBe(
      "3 items · $5.00 to $8.50 · checked Nov 22, 2026 · 06:57 UTC",
    );
  });
});
