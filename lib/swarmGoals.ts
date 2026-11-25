/**
 * Worker goal, exact JSON output schema, and normalising validators for the live
 * destination advisory worker.
 *
 * Inputs: a validated destination and condition, plus untrusted upstream result values.
 * Outputs: goal text, the matching output_schema object, and typed findings.
 * Invariants: the goal states its schema and the no-guess rule; every missing text field
 * normalises to null and every missing list to an empty array. The worker reads the
 * Government of Canada advisory page only, and reports what it states.
 */

import { CONDITION_LABELS, type Condition } from "@/lib/types";
import type {
  AdvisoryResult,
  NormalizedWorkerResult,
  SwarmFindings,
  WorkerId,
} from "@/lib/swarmTypes";

/** Canonical source page for each worker. Also the fallback sourceUrl. */
export const WORKER_SOURCES: Record<WorkerId, string> = {
  advisory: "https://travel.gc.ca/travelling/advisories",
};

/** Shared schema fragments: nullable scalars, never nullable inside a list. */
const nullableText = { type: "string", nullable: true } as const;
const textList = { type: "array", items: { type: "string" } } as const;

/** Exact structured-output schemas, sent both in the goal and as output_schema. */
export const WORKER_SCHEMAS = {
  advisory: {
    type: "object",
    properties: {
      destinationRiskLevel: nullableText,
      riskSummary: nullableText,
      healthNotices: textList,
      environmentalHazards: textList,
      sourceUrl: nullableText,
    },
    required: [
      "destinationRiskLevel",
      "riskSummary",
      "healthNotices",
      "environmentalHazards",
      "sourceUrl",
    ],
  },
} as const satisfies Record<WorkerId, Record<string, unknown>>;

/** Input shared by every worker goal. */
export interface SwarmGoalInput {
  destination: string;
  condition: Condition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MISSING_VALUES = new Set(["not found", "n/a", "na", "null", "unknown", "not specified", "not available"]);

/** Upstream is an LLM reading a web page, so every string and list is bounded. */
const TEXT_MAX = 1_200;
const LIST_MAX = 12;
const URL_MAX = 500;

/** Truncates at a code-unit boundary and marks the cut, so the UI never shows a wall. */
function boundedText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Treats placeholders as missing, so the UI can print Not found. */
function asText(value: unknown, max = TEXT_MAX): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const comparable = text.replace(/[.,;:!?]+$/, "").trim().toLowerCase().replace(/\s+/g, " ");
  if (comparable === "" || MISSING_VALUES.has(comparable)) return null;
  return boundedText(text, max);
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    const text = asText(entry);
    if (text !== null) seen.add(text);
  }
  return [...seen].slice(0, LIST_MAX);
}

function asSourceUrl(value: unknown, fallback: string): string {
  // Never truncate a URL: a shortened URL is a different destination. Reject it.
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();
  if (candidate.length === 0 || candidate.length > URL_MAX) return fallback;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? candidate : fallback;
  } catch {
    return fallback;
  }
}

/** Normalises an advisory result; unknown or missing fields become null or []. */
export function normalizeAdvisoryResult(
  value: unknown,
  fallbackSourceUrl: string,
): AdvisoryResult {
  const record = isRecord(value) ? value : {};
  return {
    destinationRiskLevel: asText(record.destinationRiskLevel),
    riskSummary: asText(record.riskSummary),
    healthNotices: asTextList(record.healthNotices),
    environmentalHazards: asTextList(record.environmentalHazards),
    sourceUrl: asSourceUrl(record.sourceUrl, fallbackSourceUrl),
  };
}

/** Dispatches to the validator for one worker and strips its sourceUrl out of findings. */
export function normalizeWorkerResult(
  worker: WorkerId,
  value: unknown,
  fallbackSourceUrl: string,
): NormalizedWorkerResult {
  switch (worker) {
    case "advisory": {
      const { sourceUrl, ...findings } = normalizeAdvisoryResult(value, fallbackSourceUrl);
      return { findings, sourceUrl };
    }
  }
}

/** All-missing findings for a worker, used when a result cannot be parsed. */
export function emptyFindings(worker: WorkerId): SwarmFindings {
  return normalizeWorkerResult(worker, null, WORKER_SOURCES[worker]).findings;
}

function workerInstruction(destination: string, condition: string): string {
  return `Read ${WORKER_SOURCES.advisory}. Report the current destination risk level for ${destination}, any outbreak or health notices that apply, and environmental hazards that matter for ${condition}. Use the advisory page's own wording for the risk level. Report only what the advisory page states.`;
}

/**
 * Builds the full goal for one worker. The exact schema appears in the text and is
 * also sent separately as output_schema by the route, so both stay in sync.
 */
export function buildWorkerGoal(worker: WorkerId, input: SwarmGoalInput): string {
  const destination = input.destination.trim();
  const condition = CONDITION_LABELS[input.condition];
  const schema = JSON.stringify(WORKER_SCHEMAS[worker], null, 2);
  return [
    `Traveler context: destination ${destination}; condition ${condition}.`,
    workerInstruction(destination, condition),
    "Return only JSON. Do not use markdown fences or add commentary.",
    "Use null for any text you cannot verify and [] for any list you cannot verify.",
    "Never guess, and never fill a gap from general knowledge.",
    "Include sourceUrl with the exact page you read.",
    `Exact JSON schema:\n${schema}`,
  ].join("\n\n");
}
