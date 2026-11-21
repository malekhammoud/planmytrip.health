/**
 * Pure derivations over the live swarm telemetry state.
 *
 * Inputs: WorkerState/SwarmState snapshots and a caller-supplied clock.
 * Outputs: elapsed time, tempo buckets, connection health, a bounded merged feed, a
 * swarm summary, merged source rows, and the staleness check.
 * Invariants: no function reads Date, timers, or the DOM; empty and malformed input
 * returns empty results; the feed is capped and heartbeats never become lines; sources
 * are deduplicated by URL or title.
 */

import {
  TELEMETRY_LIMITS,
  type SwarmState,
  type WorkerState,
  type WorkerStep,
} from "@/lib/swarmReducer";
import type { Condition } from "@/lib/types";
import type { SwarmSourceItem, WorkerId } from "@/lib/swarmTypes";

/** A run counts as quiet after this many milliseconds without any accepted event. */
export const QUIET_AFTER_MS = 12_000;

/** A run counts as stalled after this many milliseconds without any accepted event. */
export const STALLED_AFTER_MS = 30_000;

/** Default width of one tempo bar. */
export const TEMPO_BUCKET_MS = 5_000;

/** Connection state derived from the last accepted event. */
export type ConnectionHealth = "live" | "quiet" | "stalled";

/** Which worker's lines the feed should show. */
export type FeedFilter = "all" | WorkerId;

/** One rendered activity line; heartbeats are deliberately absent. */
export interface FeedLine {
  /** Stable key from worker, sequence, and kind. */
  id: string;
  worker: WorkerId;
  seq: number;
  /** Server receive time in epoch milliseconds. */
  at: number;
  kind: "progress" | "note";
  text: string;
  api?: WorkerStep["api"];
}

/** Status-bar counters derived from the current worker states. */
export interface SwarmSummary {
  /** Workers queued or running. */
  running: number;
  steps: number;
  sources: number;
  findings: number;
  completed: number;
  failed: number;
}

/** Values compared for staleness; a retry reuses this snapshot. */
export interface SwarmCompareInput {
  destination: string;
  condition: Condition;
  medication: string;
}

function firstStepAt(worker: WorkerState): number | null {
  return worker.steps[0]?.t ?? null;
}

/** Milliseconds since the run started, frozen at the terminal frame. */
export function elapsedMs(worker: WorkerState, now: number): number {
  const started = worker.startedAt ?? firstStepAt(worker);
  if (started === null) return 0;
  const end = worker.endedAt ?? now;
  return Math.max(0, end - started);
}

/**
 * Counts progress steps into fixed-width buckets starting at the first step. The last
 * bucket is the newest, so the strip reads left to right without inventing lead-in time.
 */
export function tempoBuckets(
  steps: readonly WorkerStep[],
  bucketMs = TEMPO_BUCKET_MS,
): number[] {
  if (steps.length === 0 || bucketMs <= 0) return [];
  const first = steps[0]?.t;
  if (first === undefined) return [];
  const buckets: number[] = [];
  for (const step of steps) {
    const index = Math.max(0, Math.floor((step.t - first) / bucketMs));
    if (index > 120) continue;
    while (buckets.length <= index) buckets.push(0);
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

/** Classifies silence without inventing an event: no timestamp is stalled. */
export function connectionHealth(
  lastEventAt: number | null,
  now: number,
): ConnectionHealth {
  if (lastEventAt === null) return "stalled";
  const age = now - lastEventAt;
  if (age > STALLED_AFTER_MS) return "stalled";
  if (age > QUIET_AFTER_MS) return "quiet";
  return "live";
}

/** Merges TF_API_RESULT rows with search/fetch steps that have no URL yet. */
export function collectSources(worker: WorkerState): SwarmSourceItem[] {
  const seen = new Set(worker.sources.map((item) => item.url ?? `title:${item.title ?? ""}`));
  const merged = [...worker.sources];
  for (const step of worker.steps) {
    if (step.api === undefined) continue;
    const key = `title:${step.purpose}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ title: step.purpose, api: step.api });
    if (merged.length >= TELEMETRY_LIMITS.sources) break;
  }
  return merged.slice(0, TELEMETRY_LIMITS.sources);
}

/** Status-bar counters: active workers, emitted steps, unique sources, findings. */
export function swarmSummary(state: SwarmState): SwarmSummary {
  let running = 0;
  let steps = 0;
  let sources = 0;
  let findings = 0;
  let completed = 0;
  let failed = 0;
  for (const worker of Object.values(state.workers)) {
    if (worker.phase === "queued" || worker.phase === "running") running += 1;
    if (worker.phase === "complete") completed += 1;
    if (worker.phase === "error") failed += 1;
    steps += worker.stepCount;
    sources += collectSources(worker).length;
    if (worker.findings !== null) findings += 1;
  }
  return { running, steps, sources, findings, completed, failed };
}

/** True while any worker is queued or running, so only then should the clock tick. */
export function isSwarmLive(state: SwarmState): boolean {
  return Object.values(state.workers).some(
    (worker) => worker.phase === "queued" || worker.phase === "running",
  );
}

/**
 * Merges progress and retry notes into one chronological feed, oldest first, keeping
 * only the newest `cap` lines. Ties break by sequence, then canonical worker order.
 */
export function mergedFeed(
  state: SwarmState,
  filter: FeedFilter = "all",
  cap: number = TELEMETRY_LIMITS.feed,
): FeedLine[] {
  const lines: FeedLine[] = [];
  const workers = Object.entries(state.workers) as Array<[WorkerId, WorkerState]>;
  for (const [worker, value] of workers) {
    if (filter !== "all" && filter !== worker) continue;
    for (const step of value.steps) {
      lines.push({
        id: `${worker}-p-${step.seq}`,
        worker,
        seq: step.seq,
        at: step.t,
        kind: "progress",
        text: step.purpose,
        ...(step.api === undefined ? {} : { api: step.api }),
      });
    }
    value.notes.forEach((note, index) => {
      lines.push({
        id: `${worker}-n-${index}`,
        worker,
        seq: 0,
        at: value.lastEventAt ?? firstStepAt(value) ?? 0,
        kind: "note",
        text: note,
      });
    });
  }
  lines.sort((left, right) => {
    if (left.at !== right.at) return left.at - right.at;
    if (left.seq !== right.seq) return left.seq - right.seq;
    return left.worker.localeCompare(right.worker);
  });
  return cap > 0 ? lines.slice(-cap) : [];
}

/** True when the current trip inputs no longer match the run snapshot. */
export function isStale(
  runInputs: SwarmCompareInput | null,
  currentInputs: SwarmCompareInput,
): boolean {
  if (runInputs === null) return false;
  return (
    runInputs.destination.trim() !== currentInputs.destination.trim() ||
    runInputs.condition !== currentInputs.condition ||
    runInputs.medication.trim() !== currentInputs.medication.trim()
  );
}
