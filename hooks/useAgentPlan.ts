"use client";

/**
 * Browser data source for the OpenCode concierge board.
 *
 * Inputs: the page's trip values and Deploy token.
 * Outputs: PlannerState, the run's input snapshot, and retry().
 * Invariants: no request at token 0 or with an empty destination; one POST per token;
 * a Strict Mode replay reuses the live request; a new token aborts older streams; retry
 * reuses the last run's snapshot; nothing is logged.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { streamPlannerRequest } from "@/hooks/plannerStream";
import {
  createPlannerState,
  createQueuedPlannerState,
  plannerReducer,
  type PlannerState,
} from "@/lib/agent/plannerReducer";
import type {
  BudgetLevel,
  PlannerRequest,
} from "@/lib/agent/agentTypes";
import type { Condition } from "@/lib/types";

/** Page-owned planner inputs. */
export interface UseAgentPlanInput {
  destination: string;
  days: number;
  condition: Condition;
  medication: string;
  interests: string;
  budget: BudgetLevel;
  /** Opaque browser run id; joins the planner and swarm capture rows. */
  runId: string;
  /** Anonymous install id, or empty before the page effect runs. */
  installId: string;
  /** Explicit opt-in; capture is skipped unless true. */
  captureConsent: boolean;
  /** Coverage answer needed to rebuild the engine plan for capture. */
  hasSunLifeTravelCoverage: boolean;
  /** 0 before the first Deploy. */
  runToken: number;
}

/** Snapshot used by retry and the changed-inputs warning. */
export interface AgentPlanRunInput {
  destination: string;
  days: number;
  condition: Condition;
  medication: string;
  interests: string;
  budget: BudgetLevel;
}

interface StoredRunInput extends AgentPlanRunInput {
  runToken: number;
  runId: string;
  installId: string;
  captureConsent: boolean;
  hasSunLifeTravelCoverage: boolean;
}

/** Result of {@link useAgentPlan}. */
export interface UseAgentPlanResult {
  state: PlannerState;
  runInput: AgentPlanRunInput | null;
  retry: () => void;
}

/**
 * Subscribes to POST /api/agent-plan for one Deploy token. A queued state covers the
 * render between a token change and its effect, so the previous plan never flashes.
 */
export function useAgentPlan({
  destination,
  days,
  condition,
  medication,
  interests,
  budget,
  runId,
  installId,
  captureConsent,
  hasSunLifeTravelCoverage,
  runToken,
}: UseAgentPlanInput): UseAgentPlanResult {
  const [state, dispatch] = useReducer(plannerReducer, createPlannerState());
  const [storedInput, setStoredInput] = useState<StoredRunInput | null>(null);
  const runInputRef = useRef<StoredRunInput | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightTokenRef = useRef<number | null>(null);
  const startedTokenRef = useRef(0);
  const abortTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const abortAll = useCallback((): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightTokenRef.current = null;
  }, []);

  const start = useCallback(
    (request: PlannerRequest): void => {
      if (runToken <= 0 || request.destination.length === 0) return;
      dispatch({ type: "run_started", runToken });
      const controller = new AbortController();
      controllerRef.current = controller;
      inFlightTokenRef.current = runToken;
      streamPlannerRequest({
        request,
        controller,
        dispatch,
        onSettled: () => {
          if (controllerRef.current === controller) {
            controllerRef.current = null;
            inFlightTokenRef.current = null;
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
    const trimmed = destination.trim();
    if (trimmed.length > 0 && startedTokenRef.current !== runToken) {
      if (inFlightTokenRef.current !== runToken) {
        abortAll();
        const snapshot: StoredRunInput = {
          runToken,
          destination: trimmed,
          days,
          condition,
          medication: medication.trim(),
          interests: interests.trim(),
          budget,
          runId,
          installId,
          captureConsent,
          hasSunLifeTravelCoverage,
        };
        runInputRef.current = snapshot;
        setStoredInput(snapshot);
        start({
          destination: snapshot.destination,
          days: snapshot.days,
          condition: snapshot.condition,
          medication: snapshot.medication,
          interests: snapshot.interests,
          budget: snapshot.budget,
          runId: snapshot.runId,
          installId: snapshot.installId,
          captureConsent: snapshot.captureConsent,
          hasSunLifeTravelCoverage: snapshot.hasSunLifeTravelCoverage,
        });
      }
      startedTokenRef.current = runToken;
    }
    return () => {
      abortTimerRef.current = setTimeout(() => {
        abortTimerRef.current = null;
        abortAll();
        startedTokenRef.current = 0;
      }, 0);
    };
  }, [
    abortAll,
    budget,
    captureConsent,
    condition,
    days,
    destination,
    hasSunLifeTravelCoverage,
    installId,
    interests,
    medication,
    runId,
    runToken,
    start,
  ]);

  const retry = useCallback((): void => {
    const snapshot = runInputRef.current;
    if (snapshot === null || snapshot.runToken !== runToken) return;
    abortAll();
    start({
      destination: snapshot.destination,
      days: snapshot.days,
      condition: snapshot.condition,
      medication: snapshot.medication,
      interests: snapshot.interests,
      budget: snapshot.budget,
      runId: snapshot.runId,
      installId: snapshot.installId,
      captureConsent: snapshot.captureConsent,
      hasSunLifeTravelCoverage: snapshot.hasSunLifeTravelCoverage,
    });
  }, [abortAll, runToken, start]);

  const currentState =
    state.runToken === runToken
      ? state
      : runToken > 0 && destination.trim().length > 0
        ? createQueuedPlannerState(runToken)
        : createPlannerState(runToken);

  const runInput: AgentPlanRunInput | null =
    storedInput !== null && storedInput.runToken === runToken
      ? {
          destination: storedInput.destination,
          days: storedInput.days,
          condition: storedInput.condition,
          medication: storedInput.medication,
          interests: storedInput.interests,
          budget: storedInput.budget,
        }
      : null;

  return { state: currentState, runInput, retry };
}
