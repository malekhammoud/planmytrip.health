/**
 * Pure state machine for the live three-worker swarm monitor.
 *
 * Inputs: run lifecycle and worker event actions forwarded by hooks/useSwarm.
 * Outputs: an immutable SwarmState for AgentSwarmMonitor, re-exported with its action,
 * state, factory, and constant types from lib/swarmState so callers keep importing here.
 * Invariants: phases advance idle -> queued -> running -> complete or error and never
 * regress within a run; run_started is the only idle transition and worker events are
 * accepted only from queued or running; complete and error are terminal until
 * run_started; only the last three progress lines are kept; only allowlisted https
 * preview URLs are stored; and run_started resets only the workers it names, so a retry
 * redeploys one worker without discarding its finished siblings.
 */

import {
  PHASE_ORDER,
  PROGRESS_LIMIT,
  createWorker,
  isAllowedPreviewUrl,
  isLive,
  replaceWorker,
  withMock,
  type SwarmAction,
  type SwarmState,
} from "@/lib/swarmState";
import { WORKER_IDS, resolveWorkers } from "@/lib/swarmTypes";

export {
  PROGRESS_LIMIT,
  createQueuedSwarmState,
  createSwarmState,
  type SwarmAction,
  type SwarmDoneState,
  type SwarmState,
  type WorkerPhase,
  type WorkerState,
} from "@/lib/swarmState";

/**
 * Applies one action without mutating the previous state.
 *
 * A run_started action naming all three workers is a new Deploy: it clears the mock
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
        workers,
      };
    }

    case "worker_status": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase)) return state;
      if (PHASE_ORDER[action.status] < PHASE_ORDER[worker.phase]) return state;
      return withMock(
        replaceWorker(state, action.worker, { ...worker, phase: action.status }),
        action.mock,
      );
    }

    case "streaming_url": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase) || !isAllowedPreviewUrl(action.streamingUrl)) return state;
      return withMock(
        replaceWorker(state, action.worker, {
          ...worker,
          streamingUrl: action.streamingUrl,
        }),
        action.mock,
      );
    }

    case "worker_progress": {
      const worker = state.workers[action.worker];
      const purpose = action.purpose.trim();
      if (!isLive(worker.phase) || purpose.length === 0) return state;
      const progress = [...worker.progress, purpose].slice(-PROGRESS_LIMIT);
      return withMock(
        replaceWorker(state, action.worker, { ...worker, progress }),
        action.mock,
      );
    }

    case "worker_complete": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase)) return state;
      return withMock(
        replaceWorker(state, action.worker, {
          ...worker,
          phase: "complete",
          streamingUrl: null,
          findings: action.findings,
          sourceUrl: action.sourceUrl,
          retrievedAt: action.retrievedAt,
          rawResult: action.rawResult ?? null,
          parseError: action.parseError ?? null,
          errorCode: null,
          errorMessage: null,
        }),
        action.mock,
      );
    }

    case "worker_error": {
      const worker = state.workers[action.worker];
      if (!isLive(worker.phase)) return state;
      return withMock(
        replaceWorker(state, action.worker, {
          ...worker,
          phase: "error",
          streamingUrl: null,
          findings: null,
          sourceUrl: null,
          retrievedAt: null,
          rawResult: null,
          parseError: null,
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
