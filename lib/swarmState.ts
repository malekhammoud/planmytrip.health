/**
 * State, action, and helper definitions shared by lib/swarmReducer and its tests.
 *
 * Inputs: none. Outputs: the SwarmState/WorkerState/SwarmAction types, PROGRESS_LIMIT,
 * the initial state factories, and the immutable helpers the reducer applies.
 * Invariants: every worker begins idle with empty progress and no findings; phases are
 * idle, queued, running, complete, or error; run_started is the only idle transition and
 * worker events are accepted only from queued or running; only the last three progress
 * lines are kept; preview URLs are https on an allowlisted host.
 */

import type {
  SwarmErrorCode,
  SwarmFindings,
  SwarmSourceItem,
  TinyfishApi,
  WorkerId,
} from "@/lib/swarmTypes";

/** Lifecycle phase of one worker. `complete` and `error` are terminal. */
export type WorkerPhase = "idle" | "queued" | "running" | "complete" | "error";

/** Number of recent progress lines kept for the legacy compact list. */
export const PROGRESS_LIMIT = 3;

/** Caps that keep a long run's telemetry bounded in memory and in the feed. */
export const TELEMETRY_LIMITS = {
  steps: 200,
  sources: 100,
  notes: 20,
  feed: 300,
} as const;

/** One real progress step, in server receive order. */
export interface WorkerStep {
  seq: number;
  /** Server receive time in epoch milliseconds. */
  t: number;
  purpose: string;
  api?: TinyfishApi;
}

/** Heartbeat counter and the last accepted heartbeat time. */
export interface WorkerHeartbeat {
  count: number;
  lastAt: number | null;
}

/** Everything the mission control renders for one worker. */
export interface WorkerState {
  phase: WorkerPhase;
  /** Allowlisted preview URL, or null until one arrives. */
  streamingUrl: string | null;
  /** Recent progress purposes, oldest first, at most PROGRESS_LIMIT. */
  progress: readonly string[];
  /** Every accepted progress step for the live feed and tempo strip. */
  steps: readonly WorkerStep[];
  /** Number of accepted steps, including any trimmed from `steps`. */
  stepCount: number;
  /** Latest accepted purpose, retained after completion. */
  currentPurpose: string | null;
  /** TinyFish run id from STARTED. */
  runId: string | null;
  /** Run start in epoch milliseconds. */
  startedAt: number | null;
  /** Run end in epoch milliseconds; null while live or before a terminal frame. */
  endedAt: number | null;
  /** Last accepted event time, heartbeat included. */
  lastEventAt: number | null;
  /** Per-worker monotonic wire sequence; 0 before the first accepted event. */
  lastSeq: number;
  heartbeat: WorkerHeartbeat;
  /** Deduplicated source rows from TF_API_RESULT. */
  sources: readonly SwarmSourceItem[];
  /** Bounded lifecycle and retry notes. */
  notes: readonly string[];
  /** Number of retry notes emitted by the server. */
  retries: number;
  findings: SwarmFindings | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
  rawResult: string | null;
  parseError: string | null;
  /** Authenticated same-origin recording path, when one was archived. */
  recordingUrl: string | null;
  errorCode: SwarmErrorCode | null;
  /** Calm, user-facing failure cause. */
  errorMessage: string | null;
}

/** Final completion lists carried by swarm_done, in canonical worker order. */
export interface SwarmDoneState {
  completed: readonly WorkerId[];
  failed: readonly WorkerId[];
}

/** Complete reducer state for the monitor. */
export interface SwarmState {
  /** Page Deploy token the state belongs to; 0 before the first run. */
  runToken: number;
  /** Whether any payload this run was mock data. */
  mock: boolean;
  /** Last swarm_done, cleared when a run or retry starts. */
  done: SwarmDoneState | null;
  /** When a cached verification was produced, or null for a live run. */
  cachedAt: string | null;
  workers: Record<WorkerId, WorkerState>;
}

/** Every transition accepted by `swarmReducer`. */
export type SwarmAction =
  | { type: "run_started"; runToken: number; workers: readonly WorkerId[] }
  | {
      type: "worker_status";
      worker: WorkerId;
      status: "queued" | "running";
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "worker_started";
      worker: WorkerId;
      runId: string | null;
      startedAt: string;
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "streaming_url";
      worker: WorkerId;
      streamingUrl: string;
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "worker_progress";
      worker: WorkerId;
      purpose: string;
      tinyfishApi?: TinyfishApi;
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "worker_sources";
      worker: WorkerId;
      items: readonly SwarmSourceItem[];
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "worker_heartbeat";
      worker: WorkerId;
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "worker_note";
      worker: WorkerId;
      message: string;
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "worker_complete";
      worker: WorkerId;
      findings: SwarmFindings;
      sourceUrl: string;
      retrievedAt: string;
      rawResult?: string;
      parseError?: string;
      cachedAt?: string;
      recordingUrl?: string;
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "worker_error";
      worker: WorkerId;
      message: string;
      code?: SwarmErrorCode;
      seq?: number;
      ts?: string;
      mock?: true;
    }
  | {
      type: "swarm_done";
      completed: readonly WorkerId[];
      failed: readonly WorkerId[];
      seq?: number;
      ts?: string;
      mock?: true;
      cachedAt?: string;
    }
  | { type: "stream_failed"; message: string; workers?: readonly WorkerId[] };

/** Rank of the in-flight phases; idle is not ranked because it accepts no worker events. */
export const PHASE_ORDER: Record<"queued" | "running", number> = {
  queued: 1,
  running: 2,
};

/** True for phases that can accept worker events; idle accepts only run_started. */
export function isLive(
  phase: WorkerPhase,
): phase is "queued" | "running" {
  return phase === "queued" || phase === "running";
}

// VERIFY: TinyFish preview hosts. Docs still show *.unikraft.app, but a live production
// run on 2026-11-21 returned https://ip-*.tetra-data.production.tinyfish.io/..., so both
// provider domains are allowlisted. mock.invalid is the dev-only mock host.
/**
 * True only for the dev-only same-origin mock browser path or an https preview URL on
 * mock.invalid or a *.unikraft.app / *.tinyfish.io host. This keeps app-origin,
 * javascript, data, http, and third-party frames out of the live columns.
 */
export function isAllowedPreviewUrl(value: string): boolean {
  if (/^\/mock-browser\/(?:advisory|pharmacy|coverage)$/.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "mock.invalid") return true;
    return ["unikraft.app", "tinyfish.io"].some((domain) =>
      url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

/** Creates an empty worker state in the given phase. */
export function createWorker(phase: WorkerPhase): WorkerState {
  return {
    phase,
    streamingUrl: null,
    progress: [],
    steps: [],
    stepCount: 0,
    currentPurpose: null,
    runId: null,
    startedAt: null,
    endedAt: null,
    lastEventAt: null,
    lastSeq: 0,
    heartbeat: { count: 0, lastAt: null },
    sources: [],
    notes: [],
    retries: 0,
    findings: null,
    sourceUrl: null,
    retrievedAt: null,
    rawResult: null,
    parseError: null,
    recordingUrl: null,
    errorCode: null,
    errorMessage: null,
  };
}

function createWorkerMap(phase: WorkerPhase): Record<WorkerId, WorkerState> {
  return {
    advisory: createWorker(phase),
    pharmacy: createWorker(phase),
    coverage: createWorker(phase),
  };
}

/** Marks the state as mock data when a payload carries the flag. */
export function withMock(state: SwarmState, mock: true | undefined): SwarmState {
  return mock === true ? { ...state, mock: true } : state;
}

/** Replaces one worker without mutating the previous state. */
export function replaceWorker(
  state: SwarmState,
  workerId: WorkerId,
  worker: WorkerState,
): SwarmState {
  return { ...state, workers: { ...state.workers, [workerId]: worker } };
}

/**
 * Creates the pristine monitor state. Token 0 and every worker idle drive the
 * designed empty state; pass a token only for a derived state before the effect runs.
 */
export function createSwarmState(runToken = 0): SwarmState {
  return {
    runToken,
    mock: false,
    done: null,
    cachedAt: null,
    workers: createWorkerMap("idle"),
  };
}

/**
 * Creates a fresh state with all three workers queued. The hook returns this for one
 * render when the page's token has advanced but the effect has not dispatched yet, so
 * a new Deploy never flashes the previous run's findings.
 */
export function createQueuedSwarmState(runToken: number): SwarmState {
  return {
    runToken,
    mock: false,
    done: null,
    cachedAt: null,
    workers: createWorkerMap("queued"),
  };
}
