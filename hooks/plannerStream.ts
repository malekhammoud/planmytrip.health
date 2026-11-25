/**
 * Transport for the concierge planner hook: one POST and the shared SSE loop.
 *
 * Inputs: a validated request, an abort controller, the reducer dispatch, and a
 * settlement callback. Outputs: typed actions, including stream_failed when the
 * connection cannot finish, with an explicit plan-limit code when the server sends one.
 * Invariants: frames after an abort are ignored; server errors never echo raw text;
 * the caller owns the controller.
 */

import type { Dispatch } from "react";
import { asText, applyPlannerFrame, isRecord } from "@/hooks/plannerFrames";
import type { PlannerAction } from "@/lib/agent/plannerReducer";
import {
  isPlanLimitCode,
  type PlanLimitCode,
  type PlannerRequest,
} from "@/lib/agent/agentTypes";
import { createSseParser, type SseMessage } from "@/lib/sse";

const NETWORK_MESSAGE =
  "The planning service could not be reached. Check your connection and try again.";
const ENDED_MESSAGE =
  "The planning stream ended before the plan was ready. Try again.";
const UNAVAILABLE_MESSAGE =
  "The planning service is unavailable. Try again in a moment.";
const START_MESSAGE = "The planning service could not start. Try again.";

/** One planner POST failure, with the server's explicit plan-limit code when present. */
export interface PlannerFailure {
  message: string;
  code: PlanLimitCode | null;
}

/** Everything one planner POST needs. */
export interface PlannerStreamInput {
  request: PlannerRequest;
  controller: AbortController;
  dispatch: Dispatch<PlannerAction>;
  onSettled: () => void;
}

/**
 * Reads a server JSON error without echoing anything unvalidated. Only the two
 * explicit plan-limit codes survive, so the interface never branches on raw text.
 */
export function parsePlannerFailure(body: unknown, status: number): PlannerFailure {
  const fallback = status >= 500 ? UNAVAILABLE_MESSAGE : START_MESSAGE;
  if (!isRecord(body)) return { message: fallback, code: null };
  const message = asText(body.error);
  const code = isPlanLimitCode(body.code) ? body.code : null;
  return {
    message: message !== null && message.length <= 240 ? message : fallback,
    code,
  };
}

async function readFailure(response: Response): Promise<PlannerFailure> {
  try {
    return parsePlannerFailure(await response.json(), response.status);
  } catch {
    // A non-JSON body is replaced with copy that never echoes server text.
    return parsePlannerFailure(null, response.status);
  }
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
  const fail = (message: string, code: PlanLimitCode | null = null): void => {
    if (!controller.signal.aborted) {
      dispatch({ type: "stream_failed", message, ...(code === null ? {} : { code }) });
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
        const failure = await readFailure(response);
        fail(failure.message, failure.code);
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
