/**
 * Two-tier cache for live venue evidence.
 *
 * Inputs: one checked evidence row plus the recorded source and activity lines.
 * Outputs: a cached record or a miss.
 * Invariants: menu keys ignore dates; hotel keys include check-in, check-out, and party;
 * hotel rows expire in hours, menus in days; cached rows pass the same evidence validator
 * as live TinyFish output; legacy evidence-only rows still read.
 */

import { asHttpUrl, asText, isRecord } from "@/lib/agent/agentParse";
import { cacheEnabled, readCacheRow, touchCacheRow, writeCacheRow } from "./cacheStore";
import type {
  VenueEvidence,
  VenueSourceItem,
} from "@/lib/venue/types";
import { parseVenueEvidence } from "@/lib/venue/types";
import type { VenueActivityKind } from "@/lib/venue/venueState";

// VERIFY: menu freshness of 7 days and room-rate freshness of 12 hours are product
// choices, not provider limits; revisit them with real venue change rates.
const VENUE_TTL_MENU_MS = 7 * 24 * 60 * 60 * 1_000;
const VENUE_TTL_HOTEL_MS = 12 * 60 * 60 * 1_000;
const CACHE_VERSION = 2;
const ACTIVITY_MAX = 30;
const SOURCE_MAX = 30;

/** One recorded browser action stored with a cached result. */
export interface VenueCacheActivity {
  text: string;
  kind: VenueActivityKind;
  offsetSec: number;
}

/** Everything a cached venue hit replays. */
export interface VenueCacheRecord {
  evidence: VenueEvidence;
  sources: VenueSourceItem[];
  activity: VenueCacheActivity[];
  durationSec: number;
}

/** Builds the canonical key for one venue result. The place id keeps two venues that
 * share a listing URL from overwriting each other's evidence. */
export function venueCacheKey(input: {
  kind: "menu" | "hotel";
  url: string;
  placeId?: string;
  checkIn?: string;
  checkOut?: string;
  travelers?: number;
}): string {
  const parts = [`v2`, "venue", input.kind, input.url, input.placeId ?? ""];
  if (input.kind === "hotel") {
    parts.push(input.checkIn ?? "", input.checkOut ?? "", String(input.travelers ?? ""));
  }
  return parts.join("|");
}

function parseSources(value: unknown): VenueSourceItem[] {
  if (!Array.isArray(value)) return [];
  const items: VenueSourceItem[] = [];
  for (const entry of value.slice(0, SOURCE_MAX)) {
    if (!isRecord(entry)) continue;
    const url = asHttpUrl(entry.url) ?? undefined;
    const title = asText(entry.title, 200) ?? undefined;
    const api = entry.api === "search" || entry.api === "fetch" ? entry.api : "fetch";
    if (url === undefined && title === undefined) continue;
    items.push({ ...(url === undefined ? {} : { url }), ...(title === undefined ? {} : { title }), api });
  }
  return items;
}

function parseActivity(value: unknown): VenueCacheActivity[] {
  if (!Array.isArray(value)) return [];
  const lines: VenueCacheActivity[] = [];
  for (const entry of value.slice(0, ACTIVITY_MAX)) {
    if (!isRecord(entry)) continue;
    const text = asText(entry.text, 200);
    if (text === null) continue;
    const kind: VenueActivityKind =
      entry.kind === "search" ||
      entry.kind === "read" ||
      entry.kind === "note" ||
      entry.kind === "error"
        ? entry.kind
        : "note";
    const offset = typeof entry.offsetSec === "number" && entry.offsetSec >= 0
      ? Math.floor(entry.offsetSec)
      : 0;
    lines.push({ text, kind, offsetSec: offset });
  }
  return lines;
}

function fallbackSources(evidence: VenueEvidence): VenueSourceItem[] {
  return [{ url: evidence.sourceUrl, title: `${evidence.placeName} page`, api: "fetch" }];
}

/** Parses a stored payload, including evidence written before the v2 envelope. */
export function parseVenueCachePayload(value: unknown): VenueCacheRecord | null {
  if (!isRecord(value)) return null;
  if (value.v === CACHE_VERSION) {
    const evidence = parseVenueEvidence(value.evidence);
    if (evidence === null) return null;
    const sources = parseSources(value.sources);
    return {
      evidence,
      sources: sources.length > 0 ? sources : fallbackSources(evidence),
      activity: parseActivity(value.activity),
      durationSec:
        typeof value.durationSec === "number" && value.durationSec >= 0
          ? Math.floor(value.durationSec)
          : 0,
    };
  }
  const evidence = parseVenueEvidence(value);
  if (evidence === null) return null;
  return {
    evidence,
    sources: fallbackSources(evidence),
    activity: [],
    durationSec: 0,
  };
}

/** Reads one unexpired evidence record. */
export async function readCachedVenue(key: string): Promise<VenueCacheRecord | null> {
  if (!cacheEnabled()) return null;
  const row = await readCacheRow(key);
  if (row === null || row.kind !== "venue") return null;
  const record = parseVenueCachePayload(row.payload);
  if (record === null) return null;
  touchCacheRow(key);
  return record;
}

/** Stores one live evidence record with its recorded sources and activity. */
export async function writeCachedVenue(
  key: string,
  record: VenueCacheRecord,
  now = new Date().toISOString(),
): Promise<void> {
  if (!cacheEnabled()) return;
  const ttl = record.evidence.kind === "hotel" ? VENUE_TTL_HOTEL_MS : VENUE_TTL_MENU_MS;
  const expiresAt = new Date(Date.parse(now) + ttl).toISOString();
  await writeCacheRow({
    key,
    kind: "venue",
    columns: {
      destination: "",
      days: null,
      condition: null,
      interests: "",
      budget: "",
      transport: "",
    },
    payload: {
      v: CACHE_VERSION,
      evidence: record.evidence,
      sources: record.sources.slice(0, SOURCE_MAX),
      activity: record.activity.slice(-ACTIVITY_MAX),
      durationSec: record.durationSec,
    },
    createdAt: now,
    expiresAt,
  });
}
