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
/** Re-exported SSE parser types for existing imports. */
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
  /** Which TinyFish API the step used, when the event names one. */
  tinyfishApi: "search" | "fetch" | null;
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
  tinyfishApi: "search" | "fetch" | null;
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

function asTinyfishApi(value: unknown): "search" | "fetch" | null {
  return value === "search" || value === "fetch" ? value : null;
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
      return {
        type: "PROGRESS",
        runId,
        timestamp,
        purpose: asString(value.purpose),
        tinyfishApi: asTinyfishApi(value.tinyfish_api),
      };
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
        tinyfishApi: asTinyfishApi(value.tinyfish_api),
        result: value.result ?? null,
      };
    default:
      return null;
  }
}

/** Thrown when TinyFish answers with a non-2xx status. The message contains no secrets. */
export class TinyfishHttpError extends Error {
  readonly status: number;
  /** Machine-readable error code from the response body, when present. */
  readonly code: string | null;

  constructor(status: number, code: string | null = null) {
    super(`TinyFish returned HTTP ${status}.`);
    this.name = "TinyfishHttpError";
    this.status = status;
    this.code = code;
  }
}

/** Browser profile requested from TinyFish. */
export type TinyfishBrowserProfile = "lite" | "stealth";

/** Agent runtime limits passed through to TinyFish. */
export interface TinyfishAgentConfig {
  cursorStyle?: "fish" | "standard" | "green-pointer";
  maxSteps?: number;
  maxDurationSeconds?: number;
  mode?: "default" | "strict";
}

/** Arguments for one TinyFish run. */
export interface StreamTinyfishOptions {
  apiKey: string;
  url: string;
  goal: string;
  outputSchema?: Record<string, unknown>;
  browserProfile?: TinyfishBrowserProfile;
  agentConfig?: TinyfishAgentConfig;
  signal?: AbortSignal;
  onEvent: (event: TinyfishEvent) => void;
  /** Called with the upstream type name for any event this build does not know. */
  onUnknownEvent?: (type: string) => void;
}

const KNOWN_TYPES = new Set([
  "STARTED",
  "STREAMING_URL",
  "PROGRESS",
  "HEARTBEAT",
  "COMPLETE",
  "TF_API_RESULT",
]);

/** Reads error.code from a TinyFish JSON error without echoing the body. */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const value: unknown = await response.json();
    if (!isRecord(value) || !isRecord(value.error)) return null;
    return typeof value.error.code === "string" ? value.error.code : null;
  } catch {
    return null;
  }
}

/** Builds the documented request body, omitting empty optional groups. */
function buildRunPayload(
  options: StreamTinyfishOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { url: options.url, goal: options.goal };
  if (options.outputSchema !== undefined) payload.output_schema = options.outputSchema;
  if (options.browserProfile !== undefined) payload.browser_profile = options.browserProfile;
  if (options.agentConfig !== undefined) {
    const agentConfig: Record<string, unknown> = {};
    if (options.agentConfig.cursorStyle !== undefined) {
      agentConfig.cursor_style = options.agentConfig.cursorStyle;
    }
    if (options.agentConfig.maxSteps !== undefined) {
      agentConfig.max_steps = options.agentConfig.maxSteps;
    }
    if (options.agentConfig.maxDurationSeconds !== undefined) {
      agentConfig.max_duration_seconds = options.agentConfig.maxDurationSeconds;
    }
    if (options.agentConfig.mode !== undefined) agentConfig.mode = options.agentConfig.mode;
    payload.agent_config = agentConfig;
  }
  return payload;
}

/**
 * Runs one TinyFish automation and streams parsed events to onEvent.
 * Resolves when the upstream stream ends; rejects on non-2xx, network, or abort.
 */
export async function streamTinyfishRun(options: StreamTinyfishOptions): Promise<void> {
  const payload = buildRunPayload(options);

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
  if (!response.ok) throw new TinyfishHttpError(response.status, await readErrorCode(response));
  if (response.body === null) throw new Error(DEFAULT_STREAM_ERROR);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();

  const handleMessages = (messages: SseMessage[]): void => {
    for (const message of messages) {
      const event = parseTinyfishEvent(message.data);
      if (event !== null) {
        options.onEvent(event);
        continue;
      }
      // Count unknown types without letting an undocumented payload reach the UI.
      try {
        const value: unknown = JSON.parse(message.data);
        if (isRecord(value) && typeof value.type === "string" && !KNOWN_TYPES.has(value.type)) {
          options.onUnknownEvent?.(value.type.slice(0, 60));
        }
      } catch {
        // Invalid JSON is not an unknown type; it is simply ignored.
      }
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
