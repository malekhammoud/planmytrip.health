/**
 * Wire and cache contracts for live venue evidence.
 *
 * Inputs: untrusted request bodies and TinyFish results.
 * Outputs: validated candidate lists, menu evidence, and hotel-rate evidence.
 * Invariants: every price is a number or null; every source is an http(s) URL; dates are
 * real ISO dates; no medical claim, dose, or invented venue is accepted; lists are bounded.
 */

import { asHttpUrl, asNumber, asText, isRecord } from "@/lib/agent/agentParse";
import { isIsoDate } from "@/lib/dates";
import type { PlaceCategory } from "@/lib/agent/agentTypes";

/** What a venue job is allowed to look up. */
export type VenueKind = "menu" | "hotel";

/** One menu row exactly as the page states it. */
export interface VenueMenuItem {
  section: string | null;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  allergenNotes: string | null;
}

/** A checked menu snapshot. */
export interface MenuEvidence {
  kind: "menu";
  placeId: string | null;
  placeName: string;
  sourceUrl: string;
  retrievedAt: string;
  currency: string | null;
  items: VenueMenuItem[];
  notes: string[];
}

/** A checked hotel quote. */
export interface HotelEvidence {
  kind: "hotel";
  placeId: string | null;
  placeName: string;
  sourceUrl: string;
  retrievedAt: string;
  checkIn: string;
  checkOut: string;
  travelers: number;
  roomType: string | null;
  nightlyRate: number | null;
  total: number | null;
  taxesAndFees: number | null;
  currency: string | null;
  cancellation: string | null;
  bookingUrl: string | null;
  notes: string[];
}

/** Any venue snapshot carried to the interface or cache. */
export type VenueEvidence = MenuEvidence | HotelEvidence;

/** One selected place the server may inspect. */
export interface VenueCandidate {
  id: string;
  name: string;
  category: Extract<PlaceCategory, "stay" | "eat">;
  sourceUrl: string;
  menuUrl?: string | null;
  bookingUrl?: string | null;
}

/** A validated venue-research request. */
export interface VenueResearchRequest {
  destination: string;
  checkIn: string;
  days: number;
  travelers: number;
  places: VenueCandidate[];
}

function asBoundedNumber(value: unknown, min = 0, max = 1_000_000): number | null {
  const number = asNumber(value);
  return number !== null && number >= min && number <= max ? number : null;
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

function asStringList(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    const text = asText(entry, 300);
    if (text !== null) seen.add(text);
  }
  return [...seen].slice(0, max);
}

/** Narrows one menu item. */
function parseMenuItem(value: unknown): VenueMenuItem | null {
  if (!isRecord(value)) return null;
  const name = asText(value.name, 160);
  if (name === null) return null;
  return {
    section: asText(value.section, 80),
    name,
    description: asText(value.description, 500),
    price: asBoundedNumber(value.price),
    currency: asText(value.currency, 8),
    allergenNotes: asText(value.allergenNotes, 300),
  };
}

/** Narrows one venue evidence row. */
export function parseVenueEvidence(value: unknown): VenueEvidence | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  if (kind !== "menu" && kind !== "hotel") return null;
  const placeName = asText(value.placeName, 160);
  const sourceUrl = asHttpUrl(value.sourceUrl);
  const retrievedAt = asIso(value.retrievedAt);
  if (placeName === null || sourceUrl === null || retrievedAt === null) return null;
  const placeId = asText(value.placeId, 80);
  if (kind === "menu") {
    const items = Array.isArray(value.items)
      ? value.items
          .map(parseMenuItem)
          .filter((item): item is VenueMenuItem => item !== null)
          .slice(0, 12)
      : [];
    return {
      kind,
      placeId,
      placeName,
      sourceUrl,
      retrievedAt,
      currency: asText(value.currency, 8),
      items,
      notes: asStringList(value.notes),
    };
  }
  const checkIn = asText(value.checkIn, 10);
  const checkOut = asText(value.checkOut, 10);
  if (checkIn === null || checkOut === null || !isIsoDate(checkIn) || !isIsoDate(checkOut)) {
    return null;
  }
  const travelers = asNumber(value.travelers);
  if (travelers === null || !Number.isInteger(travelers) || travelers < 1 || travelers > 8) {
    return null;
  }
  return {
    kind,
    placeId,
    placeName,
    sourceUrl,
    retrievedAt,
    checkIn,
    checkOut,
    travelers,
    roomType: asText(value.roomType, 120),
    nightlyRate: asBoundedNumber(value.nightlyRate),
    total: asBoundedNumber(value.total),
    taxesAndFees: asBoundedNumber(value.taxesAndFees),
    currency: asText(value.currency, 8),
    cancellation: asText(value.cancellation, 300),
    bookingUrl: asHttpUrl(value.bookingUrl),
    notes: asStringList(value.notes),
  };
}

/** Narrows a list of evidence rows. */
export function parseVenueEvidenceList(value: unknown): VenueEvidence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseVenueEvidence)
    .filter((item): item is VenueEvidence => item !== null)
    .slice(0, 5);
}

function parseCandidate(value: unknown): VenueCandidate | null {
  if (!isRecord(value)) return null;
  const category = value.category;
  if (category !== "stay" && category !== "eat") return null;
  const name = asText(value.name, 160);
  const id = asText(value.id, 80);
  const sourceUrl = asHttpUrl(value.sourceUrl);
  if (name === null || id === null || sourceUrl === null) return null;
  return {
    id,
    name,
    category,
    sourceUrl,
    menuUrl: asHttpUrl(value.menuUrl),
    bookingUrl: asHttpUrl(value.bookingUrl),
  };
}

/** Validates one venue-research request. */
export function parseVenueResearchRequest(value: unknown): VenueResearchRequest | null {
  if (!isRecord(value)) return null;
  const destination = asText(value.destination, 120);
  if (destination === null) return null;
  const checkInRaw = value.checkIn === undefined ? "" : value.checkIn;
  if (typeof checkInRaw !== "string") return null;
  const checkIn = checkInRaw.trim();
  if (checkIn.length > 0 && !isIsoDate(checkIn)) return null;
  const days = asNumber(value.days);
  if (days === null || !Number.isInteger(days) || days < 1 || days > 20) return null;
  const travelers = value.travelers === undefined ? 1 : asNumber(value.travelers);
  if (
    travelers === null ||
    !Number.isInteger(travelers) ||
    travelers < 1 ||
    travelers > 8
  ) {
    return null;
  }
  if (!Array.isArray(value.places)) return null;
  const places = value.places
    .map(parseCandidate)
    .filter((place): place is VenueCandidate => place !== null);
  if (places.length === 0) return null;
  return {
    destination,
    checkIn,
    days,
    travelers,
    places: places.slice(0, 8),
  };
}

/** The URL a venue job should open first. */
export function candidateUrl(candidate: VenueCandidate): string {
  if (candidate.category === "stay") {
    return candidate.bookingUrl ?? candidate.sourceUrl;
  }
  return candidate.menuUrl ?? candidate.sourceUrl;
}

/** One venue page TinyFish is asked to inspect. */
export interface VenueWorkerMeta {
  id: string;
  name: string;
  category: VenueCandidate["category"];
  kind: VenueKind;
  sourceUrl: string;
}

/** One source row shown under a venue worker. */
export interface VenueSourceItem {
  url?: string;
  title?: string;
  api: "search" | "fetch";
}

/** Shared envelope for one venue worker frame. */
export interface VenueWorkerEnvelope {
  worker: string;
  seq: number;
  ts: string;
  cached?: true;
}

/** A worker entered the queue or started reading. */
export interface VenueStatusPayload extends VenueWorkerEnvelope {
  status: "queued" | "running" | "complete" | "error";
  message?: string;
}

/** One real progress line from the browser run. */
export interface VenueActivityPayload extends VenueWorkerEnvelope {
  kind: "search" | "read" | "note" | "error";
  text: string;
  /** Recorded offset from the original browser start; present on cached replays. */
  offsetSec?: number;
}

/** The live preview URL for one venue browser. */
export interface VenueStreamingUrlPayload extends VenueWorkerEnvelope {
  streamingUrl: string;
}

/** Sources consulted so far. */
export interface VenueSourcesPayload extends VenueWorkerEnvelope {
  items: VenueSourceItem[];
}

/** The checked evidence for one venue. */
export interface VenueResultPayload extends VenueWorkerEnvelope {
  evidence: VenueEvidence;
}

/** A terminal worker failure. */
export interface VenueErrorPayload extends VenueWorkerEnvelope {
  code: "missing_api_key" | "timeout" | "blocked" | "invalid_input" | "upstream_error";
  message: string;
}

/** Final counters for one research pass. */
export interface VenueDoneSummary {
  workers: number;
  menus: number;
  hotels: number;
  items: number;
  sources: number;
}

/** The first frame lists every venue job. */
export interface VenueStartedPayload {
  workers: readonly VenueWorkerMeta[];
  ts: string;
  cached?: true;
}

/** The terminal frame of every venue stream. */
export interface VenueDonePayload {
  ts: string;
  completed: string[];
  failed: string[];
  summary: VenueDoneSummary;
  cached?: true;
}

/** Any frame emitted by POST /api/venue-research. */
export type VenueEvent =
  | { event: "venue_started"; data: VenueStartedPayload }
  | { event: "venue_status"; data: VenueStatusPayload }
  | { event: "venue_activity"; data: VenueActivityPayload }
  | { event: "venue_streaming_url"; data: VenueStreamingUrlPayload }
  | { event: "venue_sources"; data: VenueSourcesPayload }
  | { event: "venue_result"; data: VenueResultPayload }
  | { event: "venue_error"; data: VenueErrorPayload }
  | { event: "venue_done"; data: VenueDonePayload };

/** Encodes one venue SSE frame. */
export function encodeVenueEvent(event: VenueEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
