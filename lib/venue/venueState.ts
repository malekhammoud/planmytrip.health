/**
 * Pure state machine for the TinyFish venue-research deck.
 *
 * Inputs: venue_* frames from POST /api/venue-research.
 * Outputs: worker phases, timestamped activity, sources, live previews, evidence, clocks,
 * and final counters.
 * Invariants: workers are created only by venue_started; evidence is stored only from a
 * venue_result; sources dedupe; the checked page is always a source; a terminal venue_done
 * never clears evidence; text is bounded.
 */

import type {
  VenueDoneSummary,
  VenueEvidence,
  VenueSourceItem,
  VenueWorkerMeta,
} from "./types";

/** Lifecycle for one venue page. */
export type VenuePhase = "queued" | "running" | "complete" | "error";

/** The kind of browser action behind one activity line. */
export type VenueActivityKind = "search" | "read" | "note" | "error";

/** One accepted, timestamped browser action. */
export interface VenueActivityLine {
  text: string;
  kind: VenueActivityKind;
  ts: string | null;
  /** Original recorded offset for a cached replay; null for a live line. */
  offsetSec: number | null;
}

/** Everything the deck renders for one venue. */
export interface VenueWorkerState {
  meta: VenueWorkerMeta;
  phase: VenuePhase;
  currentPurpose: string | null;
  activity: readonly VenueActivityLine[];
  sources: readonly VenueSourceItem[];
  streamingUrl: string | null;
  evidence: VenueEvidence | null;
  error: string | null;
  /** Accepted browser actions; the deck labels this count "actions". */
  steps: number;
  cached: boolean;
  startedAt: string | null;
  endedAt: string | null;
}

/** Complete state for one venue-research pass. */
export interface VenueResearchState {
  status: "idle" | "running" | "complete" | "error";
  workers: Record<string, VenueWorkerState>;
  order: readonly string[];
  done: VenueDoneSummary | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Every transition accepted by the venue reducer. */
export type VenueAction =
  | { type: "run_started" }
  | { type: "venue_started"; workers: readonly VenueWorkerMeta[]; ts?: string }
  | {
      type: "venue_status";
      worker: string;
      phase: VenuePhase;
      message?: string;
      ts?: string;
      cached?: true;
    }
  | {
      type: "venue_activity";
      worker: string;
      text: string;
      kind?: VenueActivityKind;
      ts?: string;
      offsetSec?: number;
    }
  | { type: "venue_streaming_url"; worker: string; streamingUrl: string; ts?: string }
  | { type: "venue_sources"; worker: string; items: readonly VenueSourceItem[]; ts?: string }
  | {
      type: "venue_result";
      worker: string;
      evidence: VenueEvidence;
      ts?: string;
      cached?: true;
    }
  | { type: "venue_error"; worker: string; message: string; ts?: string }
  | { type: "venue_done"; done: VenueDoneSummary; ts?: string }
  | { type: "stream_failed"; message: string; ts?: string };

const ACTIVITY_LIMIT = 12;

/** Creates the designed empty state. */
export function createVenueState(): VenueResearchState {
  return {
    status: "idle",
    workers: {},
    order: [],
    done: null,
    error: null,
    startedAt: null,
    finishedAt: null,
  };
}

function mergeSources(
  existing: readonly VenueSourceItem[],
  incoming: readonly VenueSourceItem[],
): VenueSourceItem[] {
  const seen = new Set(existing.map((item) => item.url ?? `title:${item.title ?? ""}`));
  const merged = [...existing];
  for (const item of incoming) {
    const key = item.url ?? `title:${item.title ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= 100) break;
  }
  return merged;
}

function worker(state: VenueResearchState, id: string): VenueWorkerState | null {
  return state.workers[id] ?? null;
}

function replaceWorker(
  state: VenueResearchState,
  id: string,
  value: VenueWorkerState,
): VenueResearchState {
  return { ...state, workers: { ...state.workers, [id]: value } };
}

/** Applies one frame without mutating the previous state. */
export function venueReducer(
  state: VenueResearchState,
  action: VenueAction,
): VenueResearchState {
  switch (action.type) {
    case "run_started":
      return { ...createVenueState(), status: "running" };

    case "venue_started": {
      const workers: Record<string, VenueWorkerState> = {};
      for (const meta of action.workers) {
        workers[meta.id] = {
          meta,
          phase: "queued",
          currentPurpose: null,
          activity: [],
          sources: [],
          streamingUrl: null,
          evidence: null,
          error: null,
          steps: 0,
          cached: false,
          startedAt: null,
          endedAt: null,
        };
      }
      return {
        ...state,
        status: "running",
        workers,
        order: action.workers.map((meta) => meta.id),
        startedAt: state.startedAt ?? action.ts ?? null,
      };
    }

    case "venue_status": {
      const value = worker(state, action.worker);
      if (value === null) return state;
      const ended =
        action.phase === "complete" || action.phase === "error"
          ? action.ts ?? value.endedAt
          : value.endedAt;
      return replaceWorker(state, action.worker, {
        ...value,
        phase: action.phase,
        currentPurpose: action.message ?? value.currentPurpose,
        cached: action.cached === true ? true : value.cached,
        startedAt:
          action.phase === "running"
            ? value.startedAt ?? action.ts ?? null
            : value.startedAt,
        endedAt: ended,
      });
    }

    case "venue_activity": {
      const value = worker(state, action.worker);
      const text = action.text.trim();
      if (value === null || text.length === 0) return state;
      const line: VenueActivityLine = {
        text: text.slice(0, 200),
        kind: action.kind ?? "note",
        ts: action.ts ?? null,
        offsetSec: action.offsetSec ?? null,
      };
      return replaceWorker(state, action.worker, {
        ...value,
        currentPurpose: line.text,
        activity: [...value.activity, line].slice(-ACTIVITY_LIMIT),
        steps: value.steps + 1,
      });
    }

    case "venue_streaming_url": {
      const value = worker(state, action.worker);
      if (value === null) return state;
      return replaceWorker(state, action.worker, {
        ...value,
        streamingUrl: action.streamingUrl,
      });
    }

    case "venue_sources": {
      const value = worker(state, action.worker);
      if (value === null) return state;
      return replaceWorker(state, action.worker, {
        ...value,
        sources: mergeSources(value.sources, action.items),
      });
    }

    case "venue_result": {
      const value = worker(state, action.worker);
      if (value === null) return state;
      const checkedPage: VenueSourceItem = {
        url: action.evidence.sourceUrl,
        title: `${action.evidence.placeName} page`,
        api: "fetch",
      };
      return replaceWorker(state, action.worker, {
        ...value,
        phase: "complete",
        evidence: action.evidence,
        error: null,
        currentPurpose:
          action.evidence.kind === "hotel"
            ? "Room rate extracted from the checked page."
            : `${action.evidence.items.length} menu items extracted from the checked page.`,
        sources: mergeSources(value.sources, [checkedPage]),
        cached: action.cached === true ? true : value.cached,
        endedAt: action.ts ?? value.endedAt,
      });
    }

    case "venue_error": {
      const value = worker(state, action.worker);
      if (value === null) return state;
      return replaceWorker(state, action.worker, {
        ...value,
        phase: "error",
        error: action.message,
        endedAt: action.ts ?? value.endedAt,
      });
    }

    case "venue_done":
      return {
        ...state,
        status: "complete",
        done: action.done,
        finishedAt: action.ts ?? state.finishedAt,
      };

    case "stream_failed":
      return {
        ...state,
        status: "error",
        error: action.message,
        finishedAt: action.ts ?? state.finishedAt,
      };
  }
}

/** Flattens all worker evidence in wire order. */
export function venueEvidence(state: VenueResearchState): VenueEvidence[] {
  return state.order.flatMap((id) => {
    const value = state.workers[id];
    return value?.evidence === undefined || value?.evidence === null
      ? []
      : [value.evidence];
  });
}
