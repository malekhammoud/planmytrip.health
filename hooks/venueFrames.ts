/**
 * Pure SSE frame validation for the TinyFish venue-research stream.
 *
 * Inputs: one parsed SseMessage and the venue reducer dispatch.
 * Outputs: typed VenueActions, plus true only when venue_done was applied.
 * Invariants: unknown events, broken JSON, bad worker ids, unsafe preview URLs, and
 * malformed evidence are dropped; timestamps and activity kinds are bounded; no partial
 * result is invented.
 */

import type { Dispatch } from "react";
import type { SseMessage } from "@/lib/sse";
import { isAllowedPreviewUrl } from "@/lib/swarmState";
import type { VenueAction, VenueActivityKind } from "@/lib/venue/venueState";
import {
  parseVenueEvidence,
  type VenueDoneSummary,
  type VenueEvidence,
  type VenueSourceItem,
  type VenueWorkerMeta,
} from "@/lib/venue/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

function asTs(value: unknown): string | undefined {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return undefined;
  return value;
}

function asKind(value: unknown): VenueActivityKind {
  return value === "search" || value === "read" || value === "note" || value === "error"
    ? value
    : "note";
}

function asWorkerMeta(value: unknown): VenueWorkerMeta | null {
  if (!isRecord(value)) return null;
  const id = asText(value.id, 80);
  const name = asText(value.name, 160);
  const kind = value.kind === "menu" || value.kind === "hotel" ? value.kind : null;
  const category = value.category === "stay" || value.category === "eat" ? value.category : null;
  const sourceUrl = value.sourceUrl;
  if (id === null || name === null || kind === null || category === null) return null;
  if (typeof sourceUrl !== "string") return null;
  return { id, name, kind, category, sourceUrl };
}

function asSourceItems(value: unknown): VenueSourceItem[] {
  if (!Array.isArray(value)) return [];
  const items: VenueSourceItem[] = [];
  for (const entry of value.slice(0, 100)) {
    if (!isRecord(entry)) continue;
    const url = typeof entry.url === "string" ? entry.url : undefined;
    const title = typeof entry.title === "string" ? entry.title.slice(0, 200) : undefined;
    const api = entry.api === "search" || entry.api === "fetch" ? entry.api : undefined;
    if (api === undefined || (url === undefined && title === undefined)) continue;
    items.push({ ...(url === undefined ? {} : { url }), ...(title === undefined ? {} : { title }), api });
  }
  return items;
}

function asSummary(value: unknown): VenueDoneSummary | null {
  if (!isRecord(value)) return null;
  const fields = ["workers", "menus", "hotels", "items", "sources"] as const;
  if (fields.some((field) => typeof value[field] !== "number")) return null;
  return {
    workers: Math.max(0, value.workers as number),
    menus: Math.max(0, value.menus as number),
    hotels: Math.max(0, value.hotels as number),
    items: Math.max(0, value.items as number),
    sources: Math.max(0, value.sources as number),
  };
}

/** Applies one frame. Returns true only for venue_done. */
export function applyVenueFrame(
  message: SseMessage,
  dispatch: Dispatch<VenueAction>,
): boolean {
  const eventName = message.event;
  if (eventName === undefined) return false;
  let raw: unknown;
  try {
    raw = JSON.parse(message.data);
  } catch {
    return false;
  }
  if (!isRecord(raw)) return false;
  const ts = asTs(raw.ts);

  if (eventName === "venue_done") {
    const summary = asSummary(raw.summary);
    const completed = Array.isArray(raw.completed)
      ? raw.completed.filter((id) => typeof id === "string")
      : [];
    const failed = Array.isArray(raw.failed)
      ? raw.failed.filter((id) => typeof id === "string")
      : [];
    if (summary === null) return false;
    dispatch({
      type: "venue_done",
      done: {
        ...summary,
        workers: Math.max(summary.workers, completed.length + failed.length),
      },
      ...(ts === undefined ? {} : { ts }),
    });
    return true;
  }

  if (eventName === "venue_started") {
    if (!Array.isArray(raw.workers)) return false;
    const workers = raw.workers
      .map(asWorkerMeta)
      .filter((meta): meta is VenueWorkerMeta => meta !== null);
    if (workers.length === 0) return false;
    dispatch({ type: "venue_started", workers, ...(ts === undefined ? {} : { ts }) });
    return false;
  }

  const worker = asText(raw.worker, 80);
  if (worker === null) return false;

  switch (eventName) {
    case "venue_status": {
      const phase = raw.status;
      if (phase !== "queued" && phase !== "running" && phase !== "complete" && phase !== "error") {
        return false;
      }
      const message = asText(raw.message);
      dispatch({
        type: "venue_status",
        worker,
        phase,
        ...(message === null ? {} : { message }),
        ...(ts === undefined ? {} : { ts }),
        ...(raw.cached === true ? { cached: true } : {}),
      });
      return false;
    }
    case "venue_activity": {
      const text = asText(raw.text);
      if (text === null) return false;
      const offset =
        typeof raw.offsetSec === "number" && Number.isFinite(raw.offsetSec) && raw.offsetSec >= 0
          ? Math.floor(raw.offsetSec)
          : undefined;
      dispatch({
        type: "venue_activity",
        worker,
        text,
        kind: asKind(raw.kind),
        ...(ts === undefined ? {} : { ts }),
        ...(offset === undefined ? {} : { offsetSec: offset }),
      });
      return false;
    }
    case "venue_streaming_url": {
      if (typeof raw.streamingUrl !== "string" || !isAllowedPreviewUrl(raw.streamingUrl)) {
        return false;
      }
      dispatch({
        type: "venue_streaming_url",
        worker,
        streamingUrl: raw.streamingUrl,
        ...(ts === undefined ? {} : { ts }),
      });
      return false;
    }
    case "venue_sources": {
      const items = asSourceItems(raw.items);
      if (items.length === 0) return false;
      dispatch({
        type: "venue_sources",
        worker,
        items,
        ...(ts === undefined ? {} : { ts }),
      });
      return false;
    }
    case "venue_result": {
      const evidence: VenueEvidence | null = parseVenueEvidence(raw.evidence);
      if (evidence === null) return false;
      dispatch({
        type: "venue_result",
        worker,
        evidence,
        ...(ts === undefined ? {} : { ts }),
        ...(raw.cached === true ? { cached: true } : {}),
      });
      return false;
    }
    case "venue_error": {
      const text = asText(raw.message);
      if (text === null) return false;
      dispatch({
        type: "venue_error",
        worker,
        message: text,
        ...(ts === undefined ? {} : { ts }),
      });
      return false;
    }
    default:
      return false;
  }
}
