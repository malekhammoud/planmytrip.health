/**
 * Transport for the concierge planner hook: one POST and the shared SSE loop.
 *
 * Inputs: a validated request, an abort controller, the reducer dispatch, and a
 * settlement callback. Outputs: typed actions, including stream_failed when the
 * connection cannot finish.
 * Invariants: frames after an abort are ignored; server errors never echo raw text;
 * the caller owns the controller.
 */

import type { Dispatch } from "react";
import { asText, applyPlannerFrame, isRecord } from "@/hooks/plannerFrames";
import type { PlannerAction } from "@/lib/agent/plannerReducer";
import type { PlannerRequest } from "@/lib/agent/agentTypes";
import { createSseParser, type SseMessage } from "@/lib/sse";

const NETWORK_MESSAGE =
  "The planning service could not be reached. Check your connection and try again.";
const ENDED_MESSAGE =
  "The planning stream ended before the plan was ready. Try again.";
const UNAVAILABLE_MESSAGE =
  "The planning service is unavailable. Try again in a moment.";
const START_MESSAGE = "The planning service could not start. Try again.";

/** Everything one planner POST needs. */
export interface PlannerStreamInput {
  request: PlannerRequest;
  controller: AbortController;
  dispatch: Dispatch<PlannerAction>;
  onSettled: () => void;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      const message = asText(body.error);
      if (message !== null && message.length <= 240) return message;
    }
  } catch {
    // A non-JSON body is replaced below with copy that never echoes server text.
  }
  return response.status >= 500 ? UNAVAILABLE_MESSAGE : START_MESSAGE;
}

/**
 * POSTs one planner request and consumes its SSE stream until planner_done or an
 * error. A closed stream before planner_done fails the run.
 */
export function streamPlannerRequest(input: PlannerStreamInput): void {
  const { controller, dispatch } = input;
  const applyFrames = (frames: SseMessage[]): boolean => {
    let sawDone = false;
    for (const frame of frames) {
      if (controller.signal.aborted) break;
      if (applyPlannerFrame(frame, dispatch)) sawDone = true;
    }
    return sawDone;
  };
  const fail = (message: string): void => {
    if (!controller.signal.aborted) {
      dispatch({ type: "stream_failed", message });
    }
  };

  void (async () => {
    let sawDone = false;
    try {
      const response = await fetch("/api/agent-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(input.request),
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        fail(message);
        return;
      }
      if (response.body === null) {
        fail(ENDED_MESSAGE);
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
      if (!sawDone) fail(ENDED_MESSAGE);
    } catch {
      fail(NETWORK_MESSAGE);
    } finally {
      input.onSettled();
    }
  })();
}
