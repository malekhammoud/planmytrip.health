/**
 * Planner result cache: exact and destination-level reuse of a finished concierge plan.
 *
 * Inputs: a validated PlannerRequest and, on write, the plan, research summaries, and
 * completion lists from one live run.
 * Outputs: a normalised cached plan with its provenance, or null on a miss.
 * Invariants: only a non-mock plan with at least one day is stored; a read validates the
 * plan through the same wire normaliser the browser uses; the exact key wins and a
 * destination + days + condition row is a clearly labelled related fallback; no origin,
 * run id, or install id is stored in the cache key.
 */

import type {
  AgentTripPlan,
  PlannerAgentId,
  PlannerRequest,
} from "@/lib/agent/agentTypes";
import { isPlannerAgentId } from "@/lib/agent/agentTypes";
import { normalizeWirePlan } from "@/lib/agent/agentPlanParse";
import {
  buildPlanCacheKey,
  cacheDestination,
  normalizeCacheText,
  planCacheIdentity,
  planCacheSignature,
  type PlanCacheSignature,
} from "./cacheKey";
import {
  cacheEnabled,
  readCacheRow,
  readPlanRowByIdentity,
  touchCacheRow,
  writeCacheRow,
  type CacheRow,
} from "./cacheStore";

const PLAN_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

/** One cached specialist summary. */
export interface CachedPlanResearch {
  agentId: PlannerAgentId;
  ok: boolean;
  summary: string;
}

/** A cache hit with enough provenance for an honest label. */
export interface CachedPlan {
  plan: AgentTripPlan;
  research: readonly CachedPlanResearch[];
  completed: readonly PlannerAgentId[];
  failed: readonly PlannerAgentId[];
  /** When the live result was produced and cached. */
  cachedAt: string;
  /** Exact preference match, or a same-destination related match. */
  match: "exact" | "related";
  signature: PlanCacheSignature;
}

/** The live result written after plan_ready. */
export interface PlanCacheWrite {
  plan: AgentTripPlan;
  research: readonly { agentId: string; ok: boolean; summary: string }[];
  completed: readonly PlannerAgentId[];
  failed: readonly PlannerAgentId[];
}

interface PlanPayload {
  plan: AgentTripPlan;
  research: CachedPlanResearch[];
  completed: PlannerAgentId[];
  failed: PlannerAgentId[];
  cachedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

function asAgentList(value: unknown): PlannerAgentId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isPlannerAgentId))];
}

function asResearch(value: unknown): CachedPlanResearch[] {
  if (!Array.isArray(value)) return [];
  const entries: CachedPlanResearch[] = [];
  for (const entry of value.slice(0, 7)) {
    if (!isRecord(entry)) continue;
    if (!isPlannerAgentId(entry.agentId) || typeof entry.ok !== "boolean") continue;
    if (typeof entry.summary !== "string" || entry.summary.trim().length === 0) continue;
    entries.push({
      agentId: entry.agentId,
      ok: entry.ok,
      summary: entry.summary.slice(0, 400),
    });
  }
  return entries;
}

type PlanPayloadResult = Omit<CachedPlan, "signature">;

function payloadFor(row: CacheRow, match: "exact" | "related"): PlanPayloadResult | null {
  if (!isRecord(row.payload)) return null;
  const plan = normalizeWirePlan(row.payload.plan);
  if (plan === null || plan.days.length === 0) return null;
  const cachedAt = asIso(row.payload.cachedAt) ?? row.createdAt;
  return {
    plan,
    research: asResearch(row.payload.research),
    completed: asAgentList(row.payload.completed),
    failed: asAgentList(row.payload.failed),
    cachedAt,
    match,
  };
}

function signatureFrom(row: CacheRow): PlanCacheSignature | null {
  if (!isRecord(row.payload) || !isRecord(row.payload.signature)) return null;
  const value = row.payload.signature;
  if (
    typeof value.destination !== "string" ||
    typeof value.days !== "number" ||
    typeof value.condition !== "string" ||
    typeof value.medication !== "string" ||
    typeof value.interests !== "string" ||
    typeof value.budget !== "string" ||
    typeof value.transport !== "string"
  ) {
    return null;
  }
  return value as unknown as PlanCacheSignature;
}

/** Reads the exact cached plan, then the newest related plan for this destination. */
export async function readCachedPlan(
  request: PlannerRequest,
): Promise<CachedPlan | null> {
  if (!cacheEnabled()) return null;
  const exactKey = buildPlanCacheKey(request);
  const exact = await readCacheRow(exactKey);
  if (exact !== null) {
    const parsed = payloadFor(exact, "exact");
    if (parsed !== null) {
      touchCacheRow(exact.key);
      return {
        ...parsed,
        signature: signatureFrom(exact) ?? planCacheSignature(request),
      };
    }
  }
  const related = await readPlanRowByIdentity(planCacheIdentity(request));
  if (related === null) return null;
  const parsed = payloadFor(related, "related");
  if (parsed === null) return null;
  touchCacheRow(related.key);
  return {
    ...parsed,
    signature: signatureFrom(related) ?? planCacheSignature(request),
  };
}

/** Stores one live plan for later exact or related reuse. */
export async function writeCachedPlan(
  request: PlannerRequest,
  input: PlanCacheWrite,
  now = new Date().toISOString(),
): Promise<void> {
  if (!cacheEnabled()) return;
  if (input.plan.mock === true || input.plan.days.length === 0) return;
  const expiresAt = new Date(Date.parse(now) + PLAN_TTL_MS).toISOString();
  const payload: PlanPayload & { signature: PlanCacheSignature } = {
    plan: input.plan,
    research: asResearch(input.research),
    completed: asAgentList(input.completed),
    failed: asAgentList(input.failed),
    cachedAt: now,
    signature: planCacheSignature(request),
  };
  await writeCacheRow({
    key: buildPlanCacheKey(request),
    kind: "plan",
    columns: {
      destination: cacheDestination(request),
      days: request.days,
      condition: request.condition,
      medication: normalizeCacheText(request.medication),
      interests: request.interests,
      budget: request.budget,
      transport: request.transport,
    },
    payload,
    createdAt: now,
    expiresAt,
  });
  console.info("[cache] stored a planner result");
}
