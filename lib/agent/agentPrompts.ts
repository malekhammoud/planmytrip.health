/**
 * Research prompts and output shapes for the concierge team.
 *
 * Inputs: a validated PlannerRequest, specialist research, and the engine's day caps.
 * Outputs: one user prompt per agent, including an exact JSON shape.
 * Invariants: every prompt carries the condition's modeled limits, forbids invented
 * facts, and keeps research and synthesis separate. Medication is a name only.
 */

import { CONDITION_PROFILES } from "@/lib/conditionProfiles";
import { CONDITION_LABELS, TRANSPORT_LABELS } from "@/lib/types";
import {
  BUDGET_LABELS,
  type PlannerCapInput,
  type PlannerRequest,
  type SpecialistAgentId,
} from "./agentTypes";

const text = { type: "string" } as const;
const nullableText = { type: "string", nullable: true } as const;
const nullableNumber = { type: "number", nullable: true } as const;
const source = { type: "string", description: "Exact page URL used for this place." } as const;

const stayItem = {
  type: "object",
  properties: {
    name: text,
    area: text,
    lat: nullableNumber,
    lng: nullableNumber,
    priceBand: nullableText,
    why: text,
    nights: nullableNumber,
    booking: nullableText,
    bookingUrl: nullableText,
    conditionNotes: nullableText,
    sourceUrl: source,
  },
  required: ["name", "area", "lat", "lng", "priceBand", "why", "nights", "booking", "bookingUrl", "conditionNotes", "sourceUrl"],
} as const;

const tableItem = {
  type: "object",
  properties: {
    name: text,
    area: text,
    lat: nullableNumber,
    lng: nullableNumber,
    cuisine: text,
    meal: text,
    priceBand: nullableText,
    why: text,
    dietaryNotes: nullableText,
    reservation: nullableText,
    menuUrl: nullableText,
    sourceUrl: source,
  },
  required: ["name", "area", "lat", "lng", "cuisine", "meal", "priceBand", "why", "dietaryNotes", "reservation", "menuUrl", "sourceUrl"],
} as const;

const trailItem = {
  type: "object",
  properties: {
    name: text,
    area: text,
    lat: nullableNumber,
    lng: nullableNumber,
    distanceKm: nullableNumber,
    elevationM: nullableNumber,
    durationMin: nullableNumber,
    difficulty: text,
    terrain: text,
    why: text,
    conditionNotes: text,
    recoveryDayAfter: { type: "boolean" },
    sourceUrl: source,
  },
  required: ["name", "area", "lat", "lng", "distanceKm", "elevationM", "durationMin", "difficulty", "terrain", "why", "conditionNotes", "recoveryDayAfter", "sourceUrl"],
} as const;

const visitItem = {
  type: "object",
  properties: {
    name: text,
    area: text,
    lat: nullableNumber,
    lng: nullableNumber,
    durationMin: nullableNumber,
    why: text,
    booking: nullableText,
    sourceUrl: source,
  },
  required: ["name", "area", "lat", "lng", "durationMin", "why", "booking", "sourceUrl"],
} as const;

const sourceItem = {
  type: "object",
  properties: { title: text, url: text },
  required: ["title", "url"],
} as const;

/** Exact research shape requested from each specialist. */
export const SPECIALIST_SCHEMAS: Readonly<
  Record<SpecialistAgentId, Record<string, unknown>>
> = {
  stay: { type: "object", properties: { stays: { type: "array", items: stayItem } }, required: ["stays"] },
  table: { type: "object", properties: { restaurants: { type: "array", items: tableItem } }, required: ["restaurants"] },
  trail: { type: "object", properties: { hikes: { type: "array", items: trailItem } }, required: ["hikes"] },
  culture: { type: "object", properties: { visits: { type: "array", items: visitItem } }, required: ["visits"] },
  transit: {
    type: "object",
    properties: {
      airportTransfer: text,
      localTransit: text,
      walkability: text,
      taxi: text,
      accessibility: text,
      notes: { type: "array", items: text },
      sources: { type: "array", items: sourceItem },
    },
    required: ["airportTransfer", "localTransit", "walkability", "taxi", "accessibility", "notes", "sources"],
  },
  care: {
    type: "object",
    properties: {
      hospitals: { type: "array", items: { type: "object", properties: { name: text, address: text, lat: nullableNumber, lng: nullableNumber, phone: nullableText, sourceUrl: source }, required: ["name", "address", "lat", "lng", "phone", "sourceUrl"] } },
      pharmacies: { type: "array", items: { type: "object", properties: { name: text, address: text, lat: nullableNumber, lng: nullableNumber, phone: nullableText, sourceUrl: source }, required: ["name", "address", "lat", "lng", "phone", "sourceUrl"] } },
      emergencyNumber: nullableText,
      localRisks: { type: "array", items: text },
      notes: { type: "array", items: text },
      sources: { type: "array", items: sourceItem },
    },
    required: ["hospitals", "pharmacies", "emergencyNumber", "localRisks", "notes", "sources"],
  },
};

/** One block in the concierge's final shape. */
const finalBlock = {
  type: "object",
  properties: {
    time: text,
    kind: text,
    title: text,
    detail: text,
    durationMin: { type: "number" },
    placeName: nullableText,
  },
  required: ["time", "kind", "title", "detail", "durationMin", "placeName"],
} as const;

/** Exact final shape requested from the concierge. */
const FINAL_SCHEMA = {
  type: "object",
  properties: {
    summary: text,
    baseArea: text,
    routeTheme: text,
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "number" },
          title: text,
          area: text,
          restDay: { type: "boolean" },
          stepEstimate: { type: "number" },
          walkingKm: { type: "number" },
          recoveryMinutes: { type: "number" },
          blocks: { type: "array", items: finalBlock },
        },
        required: ["day", "title", "area", "restDay", "stepEstimate", "walkingKm", "recoveryMinutes", "blocks"],
      },
    },
    selectedStays: { type: "array", items: text },
    selectedDining: { type: "array", items: text },
    selectedHikes: { type: "array", items: text },
    selectedVisits: { type: "array", items: text },
    selectedCare: { type: "array", items: text },
    safetyNotes: { type: "array", items: text },
    bookingChecklist: { type: "array", items: text },
    budget: {
      type: "object",
      properties: { level: text, estimatedTotal: nullableNumber, currency: text, notes: text },
      required: ["level", "estimatedTotal", "currency", "notes"],
    },
  },
  required: ["summary", "baseArea", "routeTheme", "days", "selectedStays", "selectedDining", "selectedHikes", "selectedVisits", "selectedCare", "safetyNotes", "bookingChecklist", "budget"],
} as const;

const ROLE_TASK: Readonly<Record<SpecialistAgentId, string>> = {
  stay: "Find 4 to 6 real hotels. Include at least one value, one balanced, and one premium option when available. Favor a base that shortens daily transfers.",
  table: "Find 6 to 10 real restaurants and cafes. Cover breakfast, lunch, and dinner, and include quiet options near the likely base area.",
  trail: "Find 3 to 5 real hikes or outdoor walks. Every route must fit the daily walking ceiling or explicitly describe a shortened section.",
  culture: "Find 5 to 8 real sights or experiences. Favor indoor, seated, or bookable options that need little standing.",
  transit: "Give practical current guidance for the airport transfer, local transit, walking, taxis, and accessibility. Include at least two sources.",
  care: "Find 1 to 2 hospitals, 2 to 3 pharmacies, the emergency number, and two local health risks. Do not diagnose or recommend treatment. Include source URLs.",
};

function limitsLine(request: PlannerRequest): string {
  const profile = CONDITION_PROFILES[request.condition];
  return [
    `Modeled daily ceiling: ${profile.dailyStepCeiling} steps and ${profile.maxWalkingKm} km walking.`,
    `Recovery: ${profile.recoveryMinutes} minutes${profile.mandatoryAfternoonRecovery ? " (required)" : " (recommended)"}.`,
    `Altitude limit: ${profile.altitude.maxMeters} m. Heat caution above ${profile.heat.cautionAboveCelsius} C.`,
    `Avoid: ${profile.allergens.avoid.join(", ")}.`,
  ].join(" ");
}

function tripLine(request: PlannerRequest): string {
  const medication = request.medication || "none recorded";
  return [
    `Destination: ${request.destination}.`,
    `Starting from: ${request.origin || "not provided"}.`,
    `Trip length: ${request.days} days.`,
    `Start date: ${request.checkIn || "not provided"}. Travelers: ${request.travelers}.`,
    `Condition: ${CONDITION_LABELS[request.condition]}.`,
    `Medication name only: ${medication}.`,
    `Getting around: ${TRANSPORT_LABELS[request.transport]}.`,
    `Budget: ${BUDGET_LABELS[request.budget]}.`,
    `Preferences: ${request.interests || "no extra preferences"}.`,
  ].join(" ");
}

/** Builds the research prompt for one specialist. */
export function buildSpecialistPrompt(
  agent: SpecialistAgentId,
  request: PlannerRequest,
): string {
  return [
    tripLine(request),
    limitsLine(request),
    ROLE_TASK[agent],
    "Search the web and read the actual pages. Prefer official tourism, transit, hospital, and venue pages. Use at least two independent sources when possible.",
    "Use at most 10 tool calls. Return the JSON object by your 16th step, even if some fields are null or empty. Do not start a new research branch once you have enough verified options.",
    "Record sourceUrl for every place. Use numeric latitude and longitude only when the source states or maps the location; otherwise use null.",
    "For stays, add bookingUrl when a direct booking or official rate page is available. For restaurants, add menuUrl when a direct menu page is available. Use null when absent.",
    "Return exactly one JSON object. Do not wrap it in markdown. Do not add commentary.",
    "Exact shape:",
    JSON.stringify(SPECIALIST_SCHEMAS[agent], null, 2),
  ].join("\n\n");
}

/** Builds the synthesis prompt from verified research and engine caps. */
export function buildConciergePrompt(
  request: PlannerRequest,
  research: unknown,
  caps: readonly PlannerCapInput[],
): string {
  return [
    tripLine(request),
    limitsLine(request),
    `Engine day ceilings:\n${JSON.stringify(caps, null, 2)}`,
    `Verified research:\n${JSON.stringify(research)}`,
    "Select only places named in the research. Do not invent venues, coordinates, or sources.",
    "Build exactly one day per trip day. Use each day's step and walking ceiling. Insert a rest day after any hike day, and keep at least one recovery block in every active day.",
    `Group each day around one area that the traveler can cross by ${TRANSPORT_LABELS[request.transport].toLowerCase()}. Never place two demanding days back to back; put a light or rest day between a hike and the next full day.`,
    "Use one stay as the base. Include real meals, transit, the day's anchor, recovery, and check-in or checkout where relevant.",
    "For placeName, use the exact name from the research. Use null for generic blocks such as rest, meals without a named venue, or transit.",
    "stepEstimate and walkingKm are your honest estimates for the day. recoveryMinutes must meet the profile's recovery length.",
    "Write calm, specific copy. No exclamation marks. No medical advice and no doses. Never tell the traveler to take or use a medication; refer to their clinician's plan.",
    "Keep the summary under 120 words. Write the base area and route theme as single short sentences.",
    "Return exactly one JSON object. Do not wrap it in markdown. Do not add commentary.",
    "Exact shape:",
    JSON.stringify(FINAL_SCHEMA, null, 2),
  ].join("\n\n");
}
