/**
 * TinyFish run client. The pure SSE frame parser lives in lib/sse.ts and is
 * re-exported here so existing imports keep working.
 *
 * Inputs: an API key passed by the caller, a target URL, a goal, an optional
 * output schema, an AbortSignal, and a callback for parsed upstream events.
 * Outputs: TinyfishEvent values.
 * Invariants: this module reads no environment variables and has no Node imports.
 * The API key travels only in the request header and is never logged or placed in
 * an error message.
 */

import { createSseParser, type SseMessage } from "./sse";

export { createSseParser } from "./sse";
export type { SseMessage, SseParser } from "./sse";

/** The documented TinyFish SSE endpoint. */
export const TINYFISH_RUN_SSE_URL =
  "https://agent.tinyfish.ai/v1/automation/run-sse";

const DEFAULT_STREAM_ERROR = "TinyFish returned a response without a body.";

/** Run status reported by a COMPLETE event. */
export type TinyfishRunStatus = "COMPLETED" | "FAILED" | "CANCELLED";

/** STARTED: the run was accepted. */
export interface TinyfishStartedEvent {
  type: "STARTED";
  runId: string | null;
  timestamp: string | null;
}

/** STREAMING_URL: a live preview URL, which may expire after the run. */
export interface TinyfishStreamingUrlEvent {
  type: "STREAMING_URL";
  runId: string | null;
  timestamp: string | null;
  streamingUrl: string | null;
}

/** PROGRESS: a short purpose update from the agent. */
export interface TinyfishProgressEvent {
  type: "PROGRESS";
  runId: string | null;
  timestamp: string | null;
  purpose: string | null;
}

/** HEARTBEAT: keep-alive only. */
export interface TinyfishHeartbeatEvent {
  type: "HEARTBEAT";
  timestamp: string | null;
}

/** COMPLETE: terminal status with an optional structured result. */
export interface TinyfishCompleteEvent {
  type: "COMPLETE";
  runId: string | null;
  timestamp: string | null;
  status: TinyfishRunStatus | null;
  result: unknown;
  error: string | null;
  helpUrl: string | null;
  helpMessage: string | null;
}

/** TF_API_RESULT: documented optional event whose payload shape is unspecified. */
export interface TinyfishTfApiResultEvent {
  type: "TF_API_RESULT";
  runId: string | null;
  timestamp: string | null;
  result: unknown;
}

/** Any documented TinyFish event after normalisation. Unknown types parse to null. */
export type TinyfishEvent =
  | TinyfishStartedEvent
  | TinyfishStreamingUrlEvent
  | TinyfishProgressEvent
  | TinyfishHeartbeatEvent
  | TinyfishCompleteEvent
  | TinyfishTfApiResultEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRunStatus(value: unknown): TinyfishRunStatus | null {
  return value === "COMPLETED" || value === "FAILED" || value === "CANCELLED"
    ? value
    : null;
}

function asErrorMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.message === "string") return value.message;
  return null;
}

/**
 * Parses one SSE data payload into a known TinyFish event.
 * Returns null for invalid JSON, non-object payloads, and unknown event types.
 */
export function parseTinyfishEvent(raw: string): TinyfishEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string") return null;
  const runId = asString(value.run_id);
  const timestamp = asString(value.timestamp);
  switch (value.type) {
    case "STARTED":
      return { type: "STARTED", runId, timestamp };
    case "STREAMING_URL":
      return {
        type: "STREAMING_URL",
        runId,
        timestamp,
        streamingUrl: asString(value.streaming_url),
      };
    case "PROGRESS":
      return { type: "PROGRESS", runId, timestamp, purpose: asString(value.purpose) };
    case "HEARTBEAT":
      return { type: "HEARTBEAT", timestamp };
    case "COMPLETE":
      return {
        type: "COMPLETE",
        runId,
        timestamp,
        status: asRunStatus(value.status),
        result: value.result ?? null,
        error: asErrorMessage(value.error),
        helpUrl: asString(value.help_url),
        helpMessage: asString(value.help_message),
      };
    case "TF_API_RESULT":
      return {
        type: "TF_API_RESULT",
        runId,
        timestamp,
        result: value.result ?? null,
      };
    default:
      return null;
  }
}

/** Thrown when TinyFish answers with a non-2xx status. The message contains no secrets. */
export class TinyfishHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`TinyFish returned HTTP ${status}.`);
    this.name = "TinyfishHttpError";
    this.status = status;
  }
}

/** Arguments for one TinyFish run. */
export interface StreamTinyfishOptions {
  apiKey: string;
  url: string;
  goal: string;
  outputSchema?: Record<string, unknown>;
  signal?: AbortSignal;
  onEvent: (event: TinyfishEvent) => void;
}

/**
 * Runs one TinyFish automation and streams parsed events to onEvent.
 * Resolves when the upstream stream ends; rejects on non-2xx, network, or abort.
 */
export async function streamTinyfishRun(options: StreamTinyfishOptions): Promise<void> {
  const payload: { url: string; goal: string; output_schema?: Record<string, unknown> } = {
    url: options.url,
    goal: options.goal,
  };
  if (options.outputSchema !== undefined) payload.output_schema = options.outputSchema;

  const response = await fetch(TINYFISH_RUN_SSE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-API-Key": options.apiKey,
    },
    body: JSON.stringify(payload),
    signal: options.signal,
    cache: "no-store",
  });
  if (!response.ok) throw new TinyfishHttpError(response.status);
  if (response.body === null) throw new Error(DEFAULT_STREAM_ERROR);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();

  const handleMessages = (messages: SseMessage[]): void => {
    for (const message of messages) {
      const event = parseTinyfishEvent(message.data);
      if (event !== null) options.onEvent(event);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      handleMessages(parser.push(decoder.decode(value, { stream: true })));
    }
    handleMessages(parser.push(decoder.decode()));
    handleMessages(parser.flush());
  } finally {
    reader.releaseLock();
  }
}
