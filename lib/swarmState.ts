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

import type { SwarmErrorCode, SwarmFindings, WorkerId } from "@/lib/swarmTypes";

/** Lifecycle phase of one worker. `complete` and `error` are terminal. */
export type WorkerPhase = "idle" | "queued" | "running" | "complete" | "error";

/** Number of recent progress lines kept per worker. */
export const PROGRESS_LIMIT = 3;

/** Everything the monitor renders for one worker. */
export interface WorkerState {
  phase: WorkerPhase;
  /** Allowlisted https live-preview URL, or null until one arrives. */
  streamingUrl: string | null;
  /** Recent progress purposes, oldest first, at most PROGRESS_LIMIT. */
  progress: readonly string[];
  findings: SwarmFindings | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
  rawResult: string | null;
  parseError: string | null;
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
  workers: Record<WorkerId, WorkerState>;
}

/** Every transition accepted by `swarmReducer`. */
export type SwarmAction =
  | { type: "run_started"; runToken: number; workers: readonly WorkerId[] }
  | { type: "worker_status"; worker: WorkerId; status: "queued" | "running"; mock?: true }
  | { type: "streaming_url"; worker: WorkerId; streamingUrl: string; mock?: true }
  | { type: "worker_progress"; worker: WorkerId; purpose: string; mock?: true }
  | {
      type: "worker_complete";
      worker: WorkerId;
      findings: SwarmFindings;
      sourceUrl: string;
      retrievedAt: string;
      rawResult?: string;
      parseError?: string;
      mock?: true;
    }
  | { type: "worker_error"; worker: WorkerId; message: string; code?: SwarmErrorCode; mock?: true }
  | { type: "swarm_done"; completed: readonly WorkerId[]; failed: readonly WorkerId[]; mock?: true }
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

// VERIFY: Confirm the production TinyFish live-preview host family still ends in
// .unikraft.app; mock.invalid is the dev-only mock host. Recheck before release and
// record the source and checked date in AGENTS.md section 9.
/**
 * True only for https preview URLs on mock.invalid or a *.unikraft.app host. This keeps
 * app-origin, javascript, data, http, and third-party frames out of the live columns.
 */
export function isAllowedPreviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return url.hostname === "mock.invalid" || url.hostname.endsWith(".unikraft.app");
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
    findings: null,
    sourceUrl: null,
    retrievedAt: null,
    rawResult: null,
    parseError: null,
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
    workers: createWorkerMap("queued"),
  };
}
