/**
 * Pure state machine for the live swarm monitor.
 *
 * Inputs: run lifecycle and worker event actions forwarded by hooks/useSwarm.
 * Outputs: an immutable SwarmState for the mission control, re-exported with its action,
 * state, factory, and constant types from lib/swarmState so callers keep importing here.
 * Invariants: phases advance idle -> queued -> running -> complete or error and never
 * regress within a run; run_started is the only idle transition and worker events are
 * accepted only from queued or running; complete and error are terminal until
 * run_started; per-worker sequence numbers are monotonic and duplicates or late frames
 * are ignored; steps, sources, notes, and the feed are capped; only allowlisted preview
 * URLs are stored; and run_started resets only the workers it names, so a retry redeploys
 * one worker without discarding its finished siblings.
 */

import {
  PHASE_ORDER,
  PROGRESS_LIMIT,
  TELEMETRY_LIMITS,
  createWorker,
  isAllowedPreviewUrl,
  isLive,
  replaceWorker,
  withMock,
  type SwarmAction,
  type SwarmState,
  type WorkerState,
} from "@/lib/swarmState";
import { WORKER_IDS, resolveWorkers, type SwarmSourceItem } from "@/lib/swarmTypes";

export {
  PROGRESS_LIMIT,
  TELEMETRY_LIMITS,
  createQueuedSwarmState,
  createSwarmState,
  type SwarmAction,
  type SwarmDoneState,
  type SwarmState,
  type WorkerHeartbeat,
  type WorkerPhase,
  type WorkerState,
  type WorkerStep,
} from "@/lib/swarmState";

/** Parses an ISO timestamp to epoch milliseconds, or null when absent or invalid. */
export function toMillis(value: string | undefined | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when a wire sequence is absent or has not been applied yet. */
function acceptsSeq(worker: WorkerState, seq: number | undefined): boolean {
  return seq === undefined || seq > worker.lastSeq;
}

/** Applies sequence and receive-time bookkeeping for one accepted event. */
function withEvent(
  worker: WorkerState,
  seq: number | undefined,
  ts: string | undefined,
): WorkerState {
  const at = toMillis(ts);
  return {
    ...worker,
    lastSeq: seq === undefined ? worker.lastSeq : seq,
    lastEventAt: at ?? worker.lastEventAt,
  };
}

function sourceKey(item: SwarmSourceItem): string {
  return item.url ?? `title:${item.title ?? ""}`;
}

/** Merges new source rows by URL or title, preserving order and the source cap. */
export function mergeSources(
  existing: readonly SwarmSourceItem[],
  incoming: readonly SwarmSourceItem[],
): SwarmSourceItem[] {
  const seen = new Set(existing.map(sourceKey));
  const merged = [...existing];
  for (const item of incoming) {
    const key = sourceKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= TELEMETRY_LIMITS.sources) break;
  }
  return merged.slice(0, TELEMETRY_LIMITS.sources);
}

/**
 * Applies one action without mutating the previous state.
 *
 * A run_started action naming every worker is a new Deploy: it clears the mock
 * flag and completion lists. Naming a subset is a retry: those workers return to
 * `queued` and every other worker keeps its phase and findings.
 */
export function swarmReducer(state: SwarmState, action: SwarmAction): SwarmState {
  switch (action.type) {
    case "run_started": {
      const workers = { ...state.workers };
      for (const workerId of action.workers) {
        workers[workerId] = createWorker("queued");
      }
      const newRun = new Set(action.workers).size === WORKER_IDS.length;
      return {
        runToken: action.runToken,
        mock: newRun ? false : state.mock,
        done: null,
        cachedAt: null,
        workers,
      };
    }

    case "worker_status": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase) || !acceptsSeq(worker, action.seq)) return state;
      if (PHASE_ORDER[action.status] < PHASE_ORDER[worker.phase]) return state;
      return withMock(
        replaceWorker(state, action.worker, {
          ...withEvent(worker, action.seq, action.ts),
          phase: action.status,
        }),
        action.mock,
      );
    }

    case "worker_started": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase) || !acceptsSeq(worker, action.seq)) return state;
      const startedAt = toMillis(action.startedAt) ?? toMillis(action.ts);
      return withMock(
        replaceWorker(state, action.worker, {
          ...withEvent(worker, action.seq, action.ts),
          phase: "running",
          runId: action.runId,
          startedAt: startedAt ?? worker.startedAt,
        }),
        action.mock,
      );
    }

    case "streaming_url": {
      const worker = state.workers[action.worker];
      if (
        !isLive(worker.phase) ||
        !acceptsSeq(worker, action.seq) ||
        !isAllowedPreviewUrl(action.streamingUrl)
      ) {
        return state;
      }
      return withMock(
        replaceWorker(state, action.worker, {
          ...withEvent(worker, action.seq, action.ts),
          streamingUrl: action.streamingUrl,
        }),
        action.mock,
      );
    }

    case "worker_progress": {
      const worker = state.workers[action.worker];
      const purpose = action.purpose.trim();
      if (!isLive(worker.phase) || !acceptsSeq(worker, action.seq) || purpose.length === 0) {
        return state;
      }
      const seq = action.seq ?? worker.lastSeq + 1;
      const at = toMillis(action.ts) ?? worker.lastEventAt ?? 0;
      const step = {
        seq,
        t: at,
        purpose,
        ...(action.tinyfishApi === undefined ? {} : { api: action.tinyfishApi }),
      };
      return withMock(
        replaceWorker(state, action.worker, {
          ...withEvent(worker, seq, action.ts),
          progress: [...worker.progress, purpose].slice(-PROGRESS_LIMIT),
          steps: [...worker.steps, step].slice(-TELEMETRY_LIMITS.steps),
          stepCount: worker.stepCount + 1,
          currentPurpose: purpose,
        }),
        action.mock,
      );
    }

    case "worker_sources": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase) || !acceptsSeq(worker, action.seq)) return state;
      return withMock(
        replaceWorker(state, action.worker, {
          ...withEvent(worker, action.seq, action.ts),
          sources: mergeSources(worker.sources, action.items),
        }),
        action.mock,
      );
    }

    case "worker_heartbeat": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase) || !acceptsSeq(worker, action.seq)) return state;
      const at = toMillis(action.ts);
      return withMock(
        replaceWorker(state, action.worker, {
          ...withEvent(worker, action.seq, action.ts),
          heartbeat: {
            count: worker.heartbeat.count + 1,
            lastAt: at ?? worker.heartbeat.lastAt,
          },
        }),
        action.mock,
      );
    }

    case "worker_note": {
      const worker = state.workers[action.worker];
      const message = action.message.trim();
      if (!isLive(worker.phase) || !acceptsSeq(worker, action.seq) || message.length === 0) {
        return state;
      }
      return withMock(
        replaceWorker(state, action.worker, {
          ...withEvent(worker, action.seq, action.ts),
          notes: [...worker.notes, message].slice(-TELEMETRY_LIMITS.notes),
          retries: worker.retries + 1,
        }),
        action.mock,
      );
    }

    case "worker_complete": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase) || !acceptsSeq(worker, action.seq)) return state;
      const next = withEvent(worker, action.seq, action.ts);
      const updated = replaceWorker(state, action.worker, {
        ...next,
        phase: "complete",
        streamingUrl: null,
        endedAt:
          toMillis(action.ts) ?? toMillis(action.retrievedAt) ?? worker.lastEventAt,
        findings: action.findings,
        sourceUrl: action.sourceUrl,
        retrievedAt: action.retrievedAt,
        rawResult: action.rawResult ?? null,
        parseError: action.parseError ?? null,
        recordingUrl: action.recordingUrl ?? null,
        errorCode: null,
        errorMessage: null,
      });
      return withMock(
        action.cachedAt === undefined
          ? updated
          : { ...updated, cachedAt: action.cachedAt },
        action.mock,
      );
    }

    case "worker_error": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase) || !acceptsSeq(worker, action.seq)) return state;
      const next = withEvent(worker, action.seq, action.ts);
      return withMock(
        replaceWorker(state, action.worker, {
          ...next,
          phase: "error",
          streamingUrl: null,
          endedAt: toMillis(action.ts) ?? worker.lastEventAt,
          findings: null,
          sourceUrl: null,
          retrievedAt: null,
          rawResult: null,
          parseError: null,
          recordingUrl: null,
          errorCode: action.code ?? null,
          errorMessage: action.message,
        }),
        action.mock,
      );
    }

    case "swarm_done":
      return withMock(
        {
          ...state,
          done: {
            completed: resolveWorkers(action.completed),
            failed: resolveWorkers(action.failed),
          },
          ...(action.cachedAt === undefined ? {} : { cachedAt: action.cachedAt }),
        },
        action.mock,
      );

    case "stream_failed": {
      const targets = action.workers ?? WORKER_IDS;
      const workers = { ...state.workers };
      let changed = false;
      for (const workerId of targets) {
        const worker = workers[workerId];
        if (!isLive(worker.phase)) continue;
        workers[workerId] = {
          ...worker,
          phase: "error",
          streamingUrl: null,
          endedAt: worker.lastEventAt,
          errorCode: null,
          errorMessage: action.message,
        };
        changed = true;
      }
      return changed ? { ...state, workers } : state;
    }

    default:
      return state;
  }
}
