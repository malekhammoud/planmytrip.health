"use client";

/**
 * Browser data source for the Step 6 swarm monitor.
 *
 * Inputs: the page's destination, condition, medication, and runToken (0 before the
 * first Deploy). Outputs: the current SwarmState, the run's input snapshot, and
 * retry(worker), which redeploys one worker with that snapshot.
 * Invariants: no request at token 0 or with an empty destination; one POST per run token
 * and one per retry, so a Strict Mode effect replay reuses the live request instead of
 * posting twice; a new run aborts older streams; a retry supersedes that worker's older
 * request while sibling results keep arriving and never picks up later planner edits;
 * nothing is logged.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { streamSwarmRequest } from "@/hooks/swarmStream";
import {
  createQueuedSwarmState,
  createSwarmState,
  swarmReducer,
  type SwarmState,
} from "@/lib/swarmReducer";
import { WORKER_IDS, type WorkerId } from "@/lib/swarmTypes";
import type { Condition } from "@/lib/types";

/** Everything the monitor needs to start and retry workers; all values are page-owned. */
export interface UseSwarmInput {
  /** Destination label. An empty value never starts a request. */
  destination: string;
  /** Condition used by the worker goals. */
  condition: Condition;
  /** Medication name; workers never report doses. */
  medication: string;
  /** 0 before the first Deploy; each Deploy increments it. */
  runToken: number;
}

/** The planner values a full run was deployed with; retries reuse this snapshot. */
export interface SwarmRunInput {
  /** Trimmed destination label. */
  destination: string;
  /** Condition used by the worker goals. */
  condition: Condition;
  /** Trimmed medication name; never a dose. */
  medication: string;
}

/** Stored snapshot plus the Deploy token it belongs to, for display gating. */
interface StoredRunInput extends SwarmRunInput {
  runToken: number;
}

/** Result of {@link useSwarm}. */
export interface UseSwarmResult {
  /** State for the current run token; a queued state covers the render before the effect. */
  state: SwarmState;
  /** Snapshot for the current run, or null before it starts or across a token change. */
  runInput: SwarmRunInput | null;
  /** Redeploys one worker only, using the snapshot, and leaves its siblings untouched. */
  retry: (worker: WorkerId) => void;
}

/**
 * Subscribes to POST /api/travel-swarm for the given Deploy token and exposes the
 * reducer state plus the run snapshot. Retry posts the snapshot, not current inputs.
 */
export function useSwarm({
  destination,
  condition,
  medication,
  runToken,
}: UseSwarmInput): UseSwarmResult {
  const [state, dispatch] = useReducer(swarmReducer, createSwarmState());
  const [storedInput, setStoredInput] = useState<StoredRunInput | null>(null);
  const runInputRef = useRef<StoredRunInput | null>(null);
  const controllersRef = useRef<Set<AbortController>>(new Set());
  const latestRequestRef = useRef<Record<WorkerId, number>>({
    advisory: 0,
    pharmacy: 0,
    coverage: 0,
  });
  const inFlightRunRef = useRef<{ runToken: number; controller: AbortController } | null>(
    null,
  );
  const startedTokenRef = useRef(0);
  const requestIdRef = useRef(0);
  const abortTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abortAll = useCallback((): void => {
    for (const controller of controllersRef.current) controller.abort();
    controllersRef.current.clear();
    inFlightRunRef.current = null;
  }, []);

  const startWorkers = useCallback(
    (workers: readonly WorkerId[], input: SwarmRunInput): void => {
      if (runToken <= 0 || input.destination.length === 0) return;
      dispatch({ type: "run_started", runToken, workers });

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const controller = new AbortController();
      controllersRef.current.add(controller);
      for (const worker of workers) latestRequestRef.current[worker] = requestId;
      if (workers.length === WORKER_IDS.length) {
        inFlightRunRef.current = { runToken, controller };
      }

      streamSwarmRequest({
        destination: input.destination,
        condition: input.condition,
        medication: input.medication,
        workers,
        requestId,
        latestRequest: latestRequestRef.current,
        dispatch,
        controller,
        onSettled: () => {
          controllersRef.current.delete(controller);
          if (inFlightRunRef.current?.controller === controller) {
            inFlightRunRef.current = null;
          }
        },
      });
    },
    [runToken],
  );

  useEffect(() => {
    if (abortTimerRef.current !== null) {
      clearTimeout(abortTimerRef.current);
      abortTimerRef.current = null;
    }
    if (runToken <= 0) {
      abortAll();
      startedTokenRef.current = 0;
      return;
    }
    if (destination.trim().length > 0 && startedTokenRef.current !== runToken) {
      // Reuse a live request for this exact token; otherwise this is a new Deploy.
      const inFlight = inFlightRunRef.current;
      if (inFlight === null || inFlight.runToken !== runToken) {
        abortAll();
        const snapshot: StoredRunInput = {
          runToken,
          destination: destination.trim(),
          condition,
          medication: medication.trim(),
        };
        runInputRef.current = snapshot;
        setStoredInput(snapshot);
        startWorkers(WORKER_IDS, snapshot);
      }
      startedTokenRef.current = runToken;
    }
    // Defer the abort by a tick so a Strict Mode replay or a same-token field edit can
    // keep the live stream. A real unmount has no setup to cancel it.
    return () => {
      abortTimerRef.current = setTimeout(() => {
        abortTimerRef.current = null;
        abortAll();
        startedTokenRef.current = 0;
      }, 0);
    };
  }, [abortAll, condition, destination, medication, runToken, startWorkers]);

  const retry = useCallback(
    (worker: WorkerId): void => {
      const snapshot = runInputRef.current;
      if (snapshot === null || snapshot.runToken !== runToken) return;
      startWorkers([worker], snapshot);
    },
    [runToken, startWorkers],
  );

  const currentState =
    state.runToken === runToken
      ? state
      : runToken > 0 && destination.trim().length > 0
        ? createQueuedSwarmState(runToken)
        : createSwarmState(runToken);

  const runInput: SwarmRunInput | null =
    storedInput !== null && storedInput.runToken === runToken
      ? {
          destination: storedInput.destination,
          condition: storedInput.condition,
          medication: storedInput.medication,
        }
      : null;

  return { state: currentState, runInput, retry };
}
