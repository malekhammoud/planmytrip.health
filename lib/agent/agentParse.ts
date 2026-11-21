/**
 * Pure parsing and normalisation for OpenCode agent output.
 *
 * Inputs: untrusted assistant text or message lists from the OpenCode client.
 * Outputs: one JSON value, a collected assistant transcript, or typed specialist
 * research with bounded text and validated coordinates.
 * Invariants: no invented venues, URLs, or coordinates; missing values become null or
 * empty; picks without a name are dropped; the parser never throws.
 */

import type {
  CareType,
  PlaceCategory,
  PlannerPlace,
  PlannerSource,
  SpecialistAgentId,
} from "./agentTypes";

const TEXT_MAX = 600;
const LONG_TEXT_MAX = 1200;
const URL_MAX = 500;
const MAX_PICKS = 10;
const TRANSCRIPT_MAX = 80_000;

/** One normalised research pick before the concierge selects it. */
export interface DraftPlace {
  category: PlaceCategory;
  name: string;
  area: string;
  lat: number | null;
  lng: number | null;
  why: string;
  notes: string | null;
  priceBand: string | null;
  durationMin: number | null;
  nights: number | null;
  distanceKm: number | null;
  elevationM: number | null;
  difficulty: string | null;
  booking: string | null;
  sourceUrl: string | null;
  address: string | null;
  phone: string | null;
  careType: CareType | null;
}

/** Normalised output from one specialist. */
export interface SpecialistResult {
  agentId: SpecialistAgentId;
  picks: DraftPlace[];
  notes: string[];
  sources: PlannerSource[];
  summary: string;
}

/** Narrows an untrusted value to a plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns trimmed, whitespace-collapsed text or null. */
export function asText(value: unknown, max = TEXT_MAX): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length === 0) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  const end = boundary > max * 0.6 ? boundary : max;
  return `${cut.slice(0, end).trimEnd()}…`;
}

/** Returns a finite number or null. */
export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Returns a bounded, de-duplicated list of non-empty strings. */
export function asList(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    const text = asText(entry, TEXT_MAX);
    if (text !== null) seen.add(text);
  }
  return [...seen].slice(0, max);
}

/** Accepts only absolute http(s) URLs and bounds their length. */
export function asHttpUrl(value: unknown): string | null {
  const text = asText(value, URL_MAX);
  if (text === null) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text : null;
  } catch {
    return null;
  }
}

function asCoordinate(value: unknown, min: number, max: number): number | null {
  const number = asNumber(value);
  return number !== null && number >= min && number <= max ? number : null;
}

function pair(record: Record<string, unknown>): {
  lat: number | null;
  lng: number | null;
} {
  const lat = asCoordinate(record.lat, -90, 90);
  const lng = asCoordinate(record.lng, -180, 180);
  return lat !== null && lng !== null ? { lat, lng } : { lat: null, lng: null };
}

function asSources(value: unknown): PlannerSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sources: PlannerSource[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const url = asHttpUrl(entry.url);
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: asText(entry.title, 120) ?? "Source", url });
  }
  return sources;
}

function basePlace(record: Record<string, unknown>): Omit<DraftPlace, "category"> | null {
  const name = asText(record.name, 160);
  if (name === null) return null;
  const { lat, lng } = pair(record);
  return {
    name,
    area: asText(record.area, 120) ?? "",
    lat,
    lng,
    why: asText(record.why, LONG_TEXT_MAX) ?? "",
    notes: asText(record.notes ?? record.dietaryNotes ?? record.conditionNotes, LONG_TEXT_MAX),
    priceBand: asText(record.priceBand, 60),
    durationMin: asNumber(record.durationMin),
    nights: asNumber(record.nights),
    distanceKm: asNumber(record.distanceKm),
    elevationM: asNumber(record.elevationM),
    difficulty: asText(record.difficulty, 60),
    booking: asText(record.booking ?? record.reservation, TEXT_MAX),
    sourceUrl: asHttpUrl(record.sourceUrl),
    address: asText(record.address, 240),
    phone: asText(record.phone, 80),
    careType: null,
  };
}

function pick(
  category: PlaceCategory,
  value: unknown,
  careType: CareType | null = null,
): DraftPlace | null {
  if (!isRecord(value)) return null;
  const base = basePlace(value);
  return base === null ? null : { ...base, category, careType };
}

function sourcesFromPicks(picks: readonly DraftPlace[]): PlannerSource[] {
  const seen = new Set<string>();
  const sources: PlannerSource[] = [];
  for (const item of picks) {
    if (item.sourceUrl === null || seen.has(item.sourceUrl)) continue;
    seen.add(item.sourceUrl);
    sources.push({ title: item.name, url: item.sourceUrl });
  }
  return sources;
}

function result(
  agentId: SpecialistAgentId,
  picks: DraftPlace[],
  notes: string[],
  sources: PlannerSource[],
): SpecialistResult {
  return {
    agentId,
    picks: picks.slice(0, MAX_PICKS),
    notes: notes.slice(0, 8),
    sources,
    summary: summarizeSpecialist(agentId, picks, notes),
  };
}

/** Builds the one-line result summary shown in the live roster. */
export function summarizeSpecialist(
  agentId: SpecialistAgentId,
  picks: readonly DraftPlace[],
  notes: readonly string[],
): string {
  if (agentId === "transit") {
    return notes.length > 0 ? `${notes.length} transit notes` : "No transit notes";
  }
  if (agentId === "care") {
    return `${picks.length} care resources, ${notes.length} notes`;
  }
  return `${picks.length} verified ${picks.length === 1 ? "place" : "places"}`;
}

/**
 * Normalises one specialist result. Unknown fields are ignored and every list is
 * bounded. A non-object value yields an empty result rather than throwing.
 */
export function normalizeSpecialistResult(
  agentId: SpecialistAgentId,
  value: unknown,
): SpecialistResult {
  const unwrapped =
    Array.isArray(value) && value.length === 1 && isRecord(value[0])
      ? value[0]
      : value;
  const record = isRecord(unwrapped) ? unwrapped : {};
  switch (agentId) {
    case "stay": {
      const picks = (Array.isArray(record.stays) ? record.stays : [])
        .map((entry) => pick("stay", entry))
        .filter((entry): entry is DraftPlace => entry !== null);
      return result("stay", picks, [], sourcesFromPicks(picks));
    }
    case "table": {
      const picks = (Array.isArray(record.restaurants) ? record.restaurants : [])
        .map((entry) => pick("eat", entry))
        .filter((entry): entry is DraftPlace => entry !== null);
      return result("table", picks, [], sourcesFromPicks(picks));
    }
    case "trail": {
      const picks = (Array.isArray(record.hikes) ? record.hikes : [])
        .map((entry) => pick("hike", entry))
        .filter((entry): entry is DraftPlace => entry !== null);
      return result("trail", picks, [], sourcesFromPicks(picks));
    }
    case "culture": {
      const picks = (Array.isArray(record.visits) ? record.visits : [])
        .map((entry) => pick("visit", entry))
        .filter((entry): entry is DraftPlace => entry !== null);
      return result("culture", picks, [], sourcesFromPicks(picks));
    }
    case "transit": {
      const notes = [
        ["Airport transfer", asText(record.airportTransfer, LONG_TEXT_MAX)],
        ["Local transit", asText(record.localTransit, LONG_TEXT_MAX)],
        ["Walkability", asText(record.walkability, LONG_TEXT_MAX)],
        ["Taxi", asText(record.taxi, LONG_TEXT_MAX)],
        ["Accessibility", asText(record.accessibility, LONG_TEXT_MAX)],
        ...asList(record.notes, 6).map((note) => ["Note", note] as const),
      ]
        .filter((entry): entry is [string, string] => entry[1] !== null)
        .map(([label, note]) => `${label}: ${note}`);
      return result("transit", [], notes, asSources(record.sources));
    }
    case "care": {
      const hospitals = (Array.isArray(record.hospitals) ? record.hospitals : [])
        .map((entry) => pick("care", entry, "hospital"))
        .filter((entry): entry is DraftPlace => entry !== null);
      const pharmacies = (Array.isArray(record.pharmacies) ? record.pharmacies : [])
        .map((entry) => pick("care", entry, "pharmacy"))
        .filter((entry): entry is DraftPlace => entry !== null);
      const emergency = asText(record.emergencyNumber, 80);
      const notes = [
        ...(emergency === null ? [] : [`Emergency number: ${emergency}`]),
        ...asList(record.localRisks, 5),
        ...asList(record.notes, 5),
      ];
      const picks = [...hospitals, ...pharmacies];
      return result("care", picks, notes, [
        ...sourcesFromPicks(picks),
        ...asSources(record.sources),
      ]);
    }
  }
}

function parseLoose(candidate: string): unknown | null {
  const attempts = [candidate, candidate.replace(/,\s*([}\]])/g, "$1")];
  for (const attempt of attempts) {
    try {
      const parsed: unknown = JSON.parse(attempt);
      if (isRecord(parsed) || Array.isArray(parsed)) return parsed;
    } catch {
      // Try the repaired form, then the next balanced candidate.
    }
  }
  return null;
}

function balancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

/**
 * Extracts the first parseable JSON object from an assistant transcript. Handles a
 * markdown fence, surrounding commentary with stray braces, multiple objects, and
 * trailing commas. Returns null instead of throwing.
 */
export function extractJsonObject(value: unknown): unknown | null {
  if (isRecord(value) || Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  const text = value.replace(/```(?:json)?/gi, "").trim();
  const direct = parseLoose(text);
  if (direct !== null) return direct;
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    const candidate = balancedObject(text, start);
    if (candidate === null) continue;
    const parsed = parseLoose(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Joins every assistant text part from an OpenCode message list. Tool, reasoning, and
 * user parts are ignored. The transcript is bounded to keep memory predictable.
 */
export function collectAssistantText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  const parts: string[] = [];
  for (const message of messages) {
    if (!isRecord(message) || message.type !== "assistant") continue;
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (!isRecord(part) || part.type !== "text") continue;
      const text = asText(part.text, TRANSCRIPT_MAX);
      if (text !== null) parts.push(text);
    }
  }
  return parts.join("\n").slice(0, TRANSCRIPT_MAX);
}

/** Converts one draft place into the final plan shape, assigning an id and day. */
export function finalizePlace(
  draft: DraftPlace,
  index: number,
  day: number | null,
): PlannerPlace {
  return {
    id: `place-${index + 1}`,
    name: draft.name,
    category: draft.category,
    area: draft.area,
    lat: draft.lat,
    lng: draft.lng,
    why: draft.why,
    notes: draft.notes,
    priceBand: draft.priceBand,
    durationMin: draft.durationMin,
    nights: draft.nights,
    distanceKm: draft.distanceKm,
    elevationM: draft.elevationM,
    difficulty: draft.difficulty,
    booking: draft.booking,
    sourceUrl: draft.sourceUrl,
    address: draft.address,
    phone: draft.phone,
    careType: draft.careType,
    day,
  };
}

/** True when a specialist returned usable research. */
export function specialistSucceeded(resultValue: SpecialistResult): boolean {
  return resultValue.picks.length > 0 || resultValue.notes.length > 0;
}
