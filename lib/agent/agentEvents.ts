/**
 * Human-readable activity derived from OpenCode tool events.
 *
 * Inputs: a tool name, its untrusted input, or a text delta.
 * Outputs: one short activity line and kind, or null when the text is not useful.
 * Invariants: never echo a full tool input, a secret, or a raw JSON body; hostnames and
 * queries are bounded; unknown tools degrade to a calm label.
 */

import type { PlannerActivityKind } from "./agentTypes";
import { asText, isRecord } from "./agentParse";

/** One activity line for the live planner log. */
export interface ToolActivity {
  kind: PlannerActivityKind;
  text: string;
}

const ACTIVITY_MAX = 160;

function bounded(value: string): string {
  return value.length > ACTIVITY_MAX ? `${value.slice(0, ACTIVITY_MAX - 1)}…` : value;
}

function hostOf(value: unknown): string | null {
  const text = asText(value, 500);
  if (text === null) return null;
  try {
    return new URL(text).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function queryOf(input: Record<string, unknown>): string | null {
  for (const key of ["query", "q", "search", "term"]) {
    const text = asText(input[key], 140);
    if (text !== null) return text;
  }
  return null;
}

/**
 * Converts one tool call into a calm activity line. The UI shows what the agent is
 * doing without exposing raw arguments or page content.
 */
export function toolActivity(name: string, input: unknown): ToolActivity {
  const record = isRecord(input) ? input : {};
  const normalized = name.toLowerCase();
  if (normalized.includes("search")) {
    const query = queryOf(record);
    return {
      kind: "search",
      text: bounded(query === null ? "Searching the web" : `Searching: ${query}`),
    };
  }
  if (normalized.includes("fetch") || normalized.includes("browse")) {
    const host = hostOf(record.url ?? record.uri);
    return {
      kind: "read",
      text: bounded(host === null ? "Reading a source page" : `Reading: ${host}`),
    };
  }
  if (normalized.includes("read")) {
    return { kind: "read", text: "Checking a source" };
  }
  return { kind: "tool", text: bounded(`Using ${name || "a research tool"}`) };
}

/**
 * Extracts a short, prose-like note from streamed assistant text. JSON-shaped output
 * and very short fragments are ignored so the log stays readable.
 */
export function noteFromDelta(delta: string): string | null {
  const text = delta.replace(/\s+/g, " ").trim();
  if (text.length < 32) return null;
  if (/[{}[\]"]/.test(text)) return null;
  return bounded(text.slice(-ACTIVITY_MAX));
}

/** Maps an unknown runtime failure to calm, non-sensitive copy. */
export function calmFailure(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "The planner stopped before finishing.";
  }
  return "The planning team could not finish this step. Try again.";
}
