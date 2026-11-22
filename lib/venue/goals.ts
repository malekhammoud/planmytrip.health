/**
 * TinyFish goals and output schemas for live menus and hotel quotes.
 *
 * Inputs: one validated venue candidate and the trip dates/party.
 * Outputs: a natural-language goal and a strict JSON schema.
 * Invariants: the agent may only report what the page states; missing values are null;
 * prices are numbers in the page currency; no medical advice, dose, or invented venue.
 */

import type { VenueCandidate, VenueResearchRequest } from "./types";

const text = { type: "string" } as const;
const nullableText = { type: "string", nullable: true } as const;
const nullableNumber = { type: "number", nullable: true } as const;

const menuItem = {
  type: "object",
  properties: {
    section: nullableText,
    name: text,
    description: nullableText,
    price: nullableNumber,
    currency: nullableText,
    allergenNotes: nullableText,
  },
  required: ["section", "name", "description", "price", "currency", "allergenNotes"],
} as const;

// VERIFY: both schemas use only object, array, string, number, and nullable fields, and
// every property is required, against the provider's current structured-output rules.
/** Exact shape requested from one menu job. */
export const MENU_SCHEMA = {
  type: "object",
  properties: {
    restaurantName: text,
    sourceUrl: text,
    currency: nullableText,
    items: { type: "array", items: menuItem },
    notes: { type: "array", items: text },
  },
  required: ["restaurantName", "sourceUrl", "currency", "items", "notes"],
} as const;

/** Exact shape requested from one hotel-rate job. */
export const HOTEL_SCHEMA = {
  type: "object",
  properties: {
    hotelName: text,
    sourceUrl: text,
    roomType: nullableText,
    nightlyRate: nullableNumber,
    total: nullableNumber,
    taxesAndFees: nullableNumber,
    currency: nullableText,
    cancellation: nullableText,
    bookingUrl: nullableText,
    notes: { type: "array", items: text },
  },
  required: [
    "hotelName",
    "sourceUrl",
    "roomType",
    "nightlyRate",
    "total",
    "taxesAndFees",
    "currency",
    "cancellation",
    "bookingUrl",
    "notes",
  ],
} as const;

/** Builds the restaurant-menu goal. */
export function buildMenuGoal(candidate: VenueCandidate, destination: string): string {
  return [
    `Traveler context: ${candidate.name} in ${destination}.`,
    "Open the starting page. If it links to the restaurant's official website or a menu page, follow that link.",
    "Find the current food menu. Report only dishes, descriptions, prices, currency, and allergen notes that the page states.",
    "Use null for any field the page does not state. Never guess a price, ingredient, or allergen, and never give medical or dietary advice.",
    "Ignore reviews, blog commentary, and delivery-only estimates unless the page labels them as the restaurant's current price.",
    "Return at most 12 menu items. Return only JSON. Do not use markdown or add commentary.",
    `Exact JSON schema:\n${JSON.stringify(MENU_SCHEMA, null, 2)}`,
  ].join("\n\n");
}

/** Builds the hotel-rate goal for the requested dates and party. */
export function buildHotelGoal(
  candidate: VenueCandidate,
  request: VenueResearchRequest,
  checkOut: string,
): string {
  return [
    `Traveler context: ${candidate.name} in ${request.destination}.`,
    `Stay dates: check in ${request.checkIn}, check out ${checkOut}. Travelers: ${request.travelers}.`,
    "Open the starting page. If it links to the official hotel site or a booking page, follow that link.",
    "Enter the stay dates and traveler count when the page asks for them. Capture the lowest publicly shown room rate for this stay.",
    "Report the room type, nightly rate, total, taxes and fees, currency, cancellation terms, and the booking URL. Use null for anything the page does not state.",
    "Do not invent a rate, fee, or availability. If the page shows only a 'from' rate, put it in nightlyRate and explain that in notes.",
    "Return only JSON. Do not use markdown or add commentary.",
    `Exact JSON schema:\n${JSON.stringify(HOTEL_SCHEMA, null, 2)}`,
  ].join("\n\n");
}
