/**
 * Transport for the Step 6 swarm hook: one POST and the shared SSE stream loop.
 * Frame validation lives in hooks/swarmFrames.
 *
 * Inputs: a prepared request (body values, worker subset, request id, abort controller)
 * and the reducer's dispatch. Outputs: typed actions, including a stream_failed action
 * when the response cannot be read.
 * Invariants: frames from a superseded request are ignored; a non-OK response, missing
 * body, network failure, or early close fails only the requested workers still owned by
 * this request; the caller owns the controller and is told when the request settles.
 */

import type { Dispatch } from "react";
import { applyFrame, asText, isRecord } from "@/hooks/swarmFrames";
import type { SwarmAction } from "@/lib/swarmReducer";
import { createSseParser, type SseMessage } from "@/lib/sse";
import type { WorkerId } from "@/lib/swarmTypes";
import type { Condition } from "@/lib/types";

const NETWORK_MESSAGE =
  "The verification service could not be reached. Check your connection and retry.";
const ENDED_MESSAGE =
  "The verification stream ended before every check finished. Retry the unfinished checks.";
const UNAVAILABLE_MESSAGE =
  "The verification service is unavailable. Try again in a moment.";
const START_MESSAGE = "The verification service could not start the checks. Try again.";

/** Everything one POST needs; useSwarm owns the refs and the abort controller. */
export interface SwarmRequestInput {
  /** Trimmed destination label. */
  destination: string;
  /** Condition used by the worker goals. */
  condition: Condition;
  /** Medication name; never a dose. */
  medication: string;
  /** Opaque browser run id shared with the planner capture. */
  runId: string;
  /** Anonymous install id. */
  installId: string;
  /** Explicit capture opt-in. */
  captureConsent: boolean;
  /** Workers this request covers. */
  workers: readonly WorkerId[];
  /** Monotonic id, so a retry supersedes older frames for the same worker. */
  requestId: number;
  /** Latest request id per worker, shared with useSwarm. */
  latestRequest: Record<WorkerId, number>;
  /** Reducer dispatch. */
  dispatch: Dispatch<SwarmAction>;
  /** Controller owned and stored by useSwarm. */
  controller: AbortController;
  /** Called once when the request settles, for controller bookkeeping. */
  onSettled: () => void;
}

/** Reads the route's calm JSON error, with status-based copy for anything else. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      const message = asText(body.error);
      if (message !== null && message.length <= 200) return message;
    }
  } catch {
    // A non-JSON body is replaced below with copy that never echoes server text.
  }
  return response.status >= 500 ? UNAVAILABLE_MESSAGE : START_MESSAGE;
}

/**
 * POSTs one worker request and consumes its SSE stream until the connection ends,
 * dispatching typed reducer actions. A non-OK response, a missing body, a network
 * failure, or a stream that ends before swarm_done fails only the requested workers.
 */
export function streamSwarmRequest(input: SwarmRequestInput): void {
  const { workers, requestId, latestRequest, dispatch, controller } = input;
  const applyFrames = (frames: SseMessage[]): boolean => {
    let sawDone = false;
    for (const frame of frames) {
      if (applyFrame(frame, dispatch, requestId, latestRequest)) sawDone = true;
    }
    return sawDone;
  };
  // A superseded request must never fail workers that a newer run or retry owns.
  const failCurrent = (message: string): void => {
    const current = workers.filter((worker) => latestRequest[worker] === requestId);
    if (current.length > 0) {
      dispatch({ type: "stream_failed", message, workers: current });
    }
  };

  void (async () => {
    let sawDone = false;
    try {
      const response = await fetch("/api/travel-swarm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          destination: input.destination,
          condition: input.condition,
          medication: input.medication,
          runId: input.runId,
          installId: input.installId,
          captureConsent: input.captureConsent,
          workers,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        if (!controller.signal.aborted) failCurrent(message);
        return;
      }
      if (response.body === null) {
        if (!controller.signal.aborted) failCurrent(ENDED_MESSAGE);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          const frames = parser.push(decoder.decode(chunk.value, { stream: true }));
          sawDone = applyFrames(frames) || sawDone;
        }
        sawDone = applyFrames(parser.push(decoder.decode())) || sawDone;
        sawDone = applyFrames(parser.flush()) || sawDone;
      } finally {
        reader.releaseLock();
      }
      if (!sawDone) failCurrent(ENDED_MESSAGE);
    } catch {
      if (!controller.signal.aborted) failCurrent(NETWORK_MESSAGE);
    } finally {
      input.onSettled();
    }
  })();
}
