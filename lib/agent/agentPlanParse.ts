/**
 * Builds and validates the concierge's final trip plan.
 *
 * Inputs: the concierge JSON, verified specialist research, engine day caps, and a
 * timestamp. Outputs: a complete AgentTripPlan or a wire-safe normalised plan.
 * Invariants: places come only from research picks; day caps come from the engine;
 * a day is marked outside its caps when the agent's own estimate exceeds them; every
 * unknown or malformed value is dropped rather than guessed.
 */

import {
  BUDGET_LEVELS,
  type AgentTripPlan,
  type BudgetLevel,
  type CareType,
  type PlaceCategory,
  type PlanBlockKind,
  type PlannerBudget,
  type PlannerCapInput,
  type PlannerDay,
  type PlannerDayBlock,
  type PlannerPlace,
  type PlannerRequest,
  type PlannerSource,
  type SpecialistAgentId,
} from "./agentTypes";
import {
  asHttpUrl,
  asList,
  asNumber,
  asText,
  finalizePlace,
  isRecord,
  type DraftPlace,
  type SpecialistResult,
} from "./agentParse";
import { reconcileDayCaps } from "@/lib/data/dose";
import { TRIP_DAYS_MAX } from "@/lib/healthTripTypes";

const DAY_BLOCK_KINDS: readonly PlanBlockKind[] = [
  "transit",
  "stay",
  "meal",
  "visit",
  "hike",
  "rest",
  "care",
];

const CATEGORIES: readonly PlaceCategory[] = ["stay", "eat", "hike", "visit", "care"];

function placeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function asCategory(value: unknown): PlaceCategory | null {
  return typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
    ? (value as PlaceCategory)
    : null;
}

function asCareType(value: unknown): CareType | null {
  return value === "hospital" || value === "pharmacy" ? value : null;
}

function asBlockKind(value: unknown): PlanBlockKind {
  return typeof value === "string" &&
    (DAY_BLOCK_KINDS as readonly string[]).includes(value)
    ? (value as PlanBlockKind)
    : "visit";
}

function asSourceList(value: unknown): PlannerSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sources: PlannerSource[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const url = asHttpUrl(entry.url);
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: asText(entry.title, 160) ?? "Source", url });
  }
  return sources;
}

function asBudget(value: unknown, fallback: BudgetLevel): PlannerBudget {
  const record = isRecord(value) ? value : {};
  const level =
    typeof record.level === "string" &&
    (BUDGET_LEVELS as readonly string[]).includes(record.level)
      ? (record.level as BudgetLevel)
      : fallback;
  return {
    level,
    estimatedTotal: asNumber(record.estimatedTotal),
    currency: asText(record.currency, 12) ?? "CAD",
    notes: asText(record.notes, 600) ?? "",
  };
}

function asPlanPlace(value: unknown, index: number): PlannerPlace | null {
  if (!isRecord(value)) return null;
  const category = asCategory(value.category);
  if (category === null) return null;
  const name = asText(value.name, 160);
  if (name === null) return null;
  const lat = asNumber(value.lat);
  const lng = asNumber(value.lng);
  const bookingUrl = asHttpUrl(value.bookingUrl);
  const menuUrl = asHttpUrl(value.menuUrl);
  return {
    id: asText(value.id, 80) ?? `place-${index + 1}`,
    name,
    category,
    area: asText(value.area, 120) ?? "",
    lat: lat !== null && lat >= -90 && lat <= 90 ? lat : null,
    lng: lng !== null && lng >= -180 && lng <= 180 ? lng : null,
    why: asText(value.why, 1200) ?? "",
    notes: asText(value.notes, 1200),
    priceBand: asText(value.priceBand, 60),
    durationMin: asNumber(value.durationMin),
    nights: asNumber(value.nights),
    distanceKm: asNumber(value.distanceKm),
    elevationM: asNumber(value.elevationM),
    difficulty: asText(value.difficulty, 60),
    booking: asText(value.booking, 600),
    ...(bookingUrl === null ? {} : { bookingUrl }),
    ...(menuUrl === null ? {} : { menuUrl }),
    sourceUrl: asHttpUrl(value.sourceUrl),
    address: asText(value.address, 240),
    phone: asText(value.phone, 80),
    careType: asCareType(value.careType),
    day: asNumber(value.day),
    ...(value.geocoded === true ? { geocoded: true as const } : {}),
  };
}

/** Both lookup directions: raw concierge JSON names places, the wire carries ids. */
interface PlaceLookup {
  byName: ReadonlyMap<string, PlannerPlace>;
  byId: ReadonlyMap<string, PlannerPlace>;
}

function asPlanBlock(value: unknown, lookup: PlaceLookup): PlannerDayBlock {
  const record = isRecord(value) ? value : {};
  const placeName = asText(record.placeName, 160);
  const placeId = asText(record.placeId, 80);
  const place =
    (placeName === null ? null : lookup.byName.get(placeKey(placeName)) ?? null) ??
    (placeId === null ? null : lookup.byId.get(placeId) ?? null);

  return {
    time: asText(record.time, 40) ?? "",
    kind: asBlockKind(record.kind),
    title: asText(record.title, 200) ?? "Planned block",
    detail: asText(record.detail, 900) ?? "",
    durationMin: Math.max(0, Math.min(720, asNumber(record.durationMin) ?? 0)),
    placeId: place?.id ?? null,
  };
}

function dayNumberOf(value: unknown, fallback: number): number {
  const record = isRecord(value) ? value : {};
  return Math.max(1, Math.round(asNumber(record.day) ?? fallback));
}

function asPlanDay(
  value: unknown,
  index: number,
  caps: readonly PlannerCapInput[],
  lookup: PlaceLookup,

): PlannerDay {
  const record = isRecord(value) ? value : {};
  const day = dayNumberOf(record, index + 1);
  const cap = caps.find((entry) => entry.day === day) ?? caps[index] ?? caps[0];
  const blocks = Array.isArray(record.blocks)
    ? record.blocks.map((block) => asPlanBlock(block, lookup)).slice(0, 16)
    : [];
  const stepEstimate = Math.max(0, Math.round(asNumber(record.stepEstimate) ?? 0));
  const walkingKm = Math.max(0, asNumber(record.walkingKm) ?? 0);
  const withinCaps =
    (stepEstimate === 0 || stepEstimate <= (cap?.stepCap ?? 0)) &&
    (walkingKm === 0 || walkingKm <= (cap?.walkingCapKm ?? 0));
  return {
    day,
    title: asText(record.title, 200) ?? `Day ${day}`,
    area: asText(record.area, 120) ?? "",
    restDay: record.restDay === true,
    stepEstimate,
    walkingKm,
    recoveryMinutes: Math.max(0, Math.round(asNumber(record.recoveryMinutes) ?? 0)),
    blocks,
    stepCeiling: cap?.stepCap ?? 0,
    walkingCapKm: cap?.walkingCapKm ?? 0,
    withinCaps,
    checkpoint: cap?.checkpoint ?? "",
  };
}

function defaultSelection(
  research: Partial<Record<SpecialistAgentId, SpecialistResult>>,
): DraftPlace[] {
  const all = Object.values(research).flatMap((entry) => entry?.picks ?? []);
  const take = (category: PlaceCategory, limit: number): DraftPlace[] =>
    all.filter((place) => place.category === category).slice(0, limit);
  return [
    ...take("stay", 2),
    ...take("eat", 8),
    ...take("hike", 3),
    ...take("visit", 6),
    ...take("care", 6),
  ];
}

function selectDrafts(
  record: Record<string, unknown>,
  research: Partial<Record<SpecialistAgentId, SpecialistResult>>,
): DraftPlace[] {
  const all = Object.values(research).flatMap((entry) => entry?.picks ?? []);
  const byKey = new Map<string, DraftPlace>();
  for (const place of all) byKey.set(placeKey(place.name), place);
  const names = [
    ...asList(record.selectedStays, 6),
    ...asList(record.selectedDining, 10),
    ...asList(record.selectedHikes, 5),
    ...asList(record.selectedVisits, 8),
    ...asList(record.selectedCare, 8),
  ];
  const selected: DraftPlace[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const place = byKey.get(placeKey(name));
    if (place === undefined || seen.has(placeKey(place.name))) continue;
    seen.add(placeKey(place.name));
    selected.push(place);
  }
  return selected.length > 0 ? selected : defaultSelection(research);
}

function attachDays(
  places: PlannerPlace[],
  days: readonly PlannerDay[],
): void {
  const byId = new Map(places.map((place) => [place.id, place]));
  for (const day of days) {
    for (const block of day.blocks) {
      if (block.placeId === null) continue;
      const place = byId.get(block.placeId);
      if (place !== undefined && place.day === null) place.day = day.day;
    }
  }
  for (const place of places) {
    if (place.category === "stay" && place.day === null) place.day = 1;
  }
}

function collectSources(
  places: readonly PlannerPlace[],
  research: Partial<Record<SpecialistAgentId, SpecialistResult>>,
): PlannerSource[] {
  const seen = new Set<string>();
  const sources: PlannerSource[] = [];
  const add = (title: string, url: string | null): void => {
    if (url === null || seen.has(url)) return;
    seen.add(url);
    sources.push({ title, url });
  };
  for (const place of places) add(place.name, place.sourceUrl);
  for (const entry of Object.values(research)) {
    for (const source of entry?.sources ?? []) add(source.title, source.url);
  }
  return sources.slice(0, 24);
}

/** Builds the final plan from concierge JSON and verified research. */
export function buildConciergePlan(
  value: unknown,
  request: PlannerRequest,
  research: Partial<Record<SpecialistAgentId, SpecialistResult>>,
  caps: readonly PlannerCapInput[],
  now: string,
): AgentTripPlan {
  const record = isRecord(value) ? value : {};
  const drafts = selectDrafts(record, research);
  const places = drafts.map((draft, index) => finalizePlace(draft, index, null));
  const placeByKey = new Map(places.map((place) => [placeKey(place.name), place]));
  const lookup: PlaceLookup = {

    byName: placeByKey,
    byId: new Map(places.map((place) => [place.id, place])),
  };
  const rawDays = Array.isArray(record.days)
    ? [...record.days].sort(
        (left, right) => dayNumberOf(left, 0) - dayNumberOf(right, 0),
      )
    : [];
  const built: PlannerDay[] = [];
  for (let index = 0; index < request.days; index += 1) {
    const raw = rawDays[index];
    built.push(asPlanDay(raw, index, caps, lookup));

  }
  // The agent estimate is display copy. The computed dose is the safety check: a long
  // block can exceed the engine ceiling even when the estimate looks low.
  const days = reconcileDayCaps(built, places);
  attachDays(places, days);
  const outside = days.filter((day) => !day.withinCaps);
  return {
    summary:
      asText(record.summary, 1400) ??
      `A ${request.days}-day plan for ${request.destination}, paced around ${request.interests || "rest, food, and gentle days"}.`,
    baseArea: asText(record.baseArea, 300) ?? "",
    routeTheme: asText(record.routeTheme, 300) ?? "",
    days,
    places,
    safetyNotes: [
      ...asList(record.safetyNotes, 10),
      ...(outside.length > 0
        ? ["At least one day exceeds its modeled safety ceiling. Follow the Pacing limits."]
        : []),
    ],
    bookingChecklist: asList(record.bookingChecklist, 12),
    budget: asBudget(record.budget, request.budget),
    sources: collectSources(places, research),
    generatedAt: now,
  };
}

/** Rebuilds a plan received over the wire so malformed frames render safely. */
export function normalizeWirePlan(value: unknown): AgentTripPlan | null {
  if (!isRecord(value)) return null;
  const places = Array.isArray(value.places)
    ? value.places
        .map((place, index) => asPlanPlace(place, index))
        .filter((place): place is PlannerPlace => place !== null)
        .slice(0, 32)
    : [];
  const byId = new Map(places.map((place) => [place.id, place]));
  const lookup: PlaceLookup = {
    byName: new Map(places.map((place) => [placeKey(place.name), place])),
    byId,

  };
  const caps: PlannerCapInput[] = Array.isArray(value.days)
    ? value.days.map((day, index) => {
        const record = isRecord(day) ? day : {};
        return {
          day: index + 1,
          stepCap: Math.max(0, asNumber(record.stepCeiling) ?? 0),
          walkingCapKm: Math.max(0, asNumber(record.walkingCapKm) ?? 0),
          checkpoint: asText(record.checkpoint, 800) ?? "",
        };
      })
    : [];
  const days = Array.isArray(value.days)
    ? reconcileDayCaps(
        value.days
          .map((day, index) => asPlanDay(day, index, caps, lookup))
          .slice(0, TRIP_DAYS_MAX),
        places,
      )

    : [];
  const summary = asText(value.summary, 1200);
  if (summary === null || days.length === 0) return null;
  return {
    summary,
    baseArea: asText(value.baseArea, 300) ?? "",
    routeTheme: asText(value.routeTheme, 300) ?? "",
    days,
    places,
    safetyNotes: asList(value.safetyNotes, 10),
    bookingChecklist: asList(value.bookingChecklist, 12),
    budget: asBudget(value.budget, "balanced"),
    sources: asSourceList(value.sources),
    generatedAt: asText(value.generatedAt, 40) ?? new Date(0).toISOString(),
    degraded: value.degraded === true ? true : undefined,
    mock: value.mock === true ? true : undefined,
  };
}
