/**
 * Deterministic cache identities for planner and swarm results.
 *
 * Inputs: validated planner or swarm inputs.
 * Outputs: compact canonical keys, a normalised destination, and the plan signature.
 * Invariants: two inputs that should share a cache entry normalise to the same key;
 * engine and cache versions are part of the key so stale shapes never match; no
 * identity, run id, or install id enters a key.
 */

import { ENGINE_VERSION } from "@/lib/data/types";
import type { PlannerRequest } from "@/lib/agent/agentTypes";
import type { Condition } from "@/lib/types";

/** Bump when the cached payload shape or planner prompt contract changes. */
export const CACHE_VERSION = 2;

/** Normalises place and preference text for matching, not for display. */
export function normalizeCacheText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const REGION_ALIASES: Readonly<Record<string, string>> = {
  on: "ontario",
  ont: "ontario",
  qc: "quebec",
  que: "quebec",
  bc: "british columbia",
  ab: "alberta",
  alta: "alberta",
  mb: "manitoba",
  man: "manitoba",
  sk: "saskatchewan",
  sask: "saskatchewan",
  ns: "nova scotia",
  nb: "new brunswick",
  nl: "newfoundland and labrador",
  nfld: "newfoundland and labrador",
  pe: "prince edward island",
  pei: "prince edward island",
  yt: "yukon",
  nt: "northwest territories",
  nu: "nunavut",
};

/**
 * Normalises a destination, drops a trailing home-market country, and expands a trailing
 * Canadian province abbreviation. A selected autocomplete label such as
 * "London, Ontario, Canada" must share a key with "London, Ontario".
 */
export function normalizeDestination(value: string): string {
  const normalized = normalizeCacheText(value);
  const withoutCountry = normalized
    .replace(/\b(united states of america|united states|usa|canada)$/, "")
    .trim();
  const base = withoutCountry.length > 0 ? withoutCountry : normalized;
  return base.replace(
    /\b([a-z]+)$/,
    (token) => REGION_ALIASES[token] ?? token,
  );
}

/** The fields that identify one planner result. */
export interface PlanCacheSignature {
  destination: string;
  days: number;
  condition: Condition;
  interests: string;
  budget: string;
  transport: string;
}

/** The broader identity used for a related-request cache fallback. */
export interface PlanCacheIdentity {
  destination: string;
  days: number;
  condition: Condition;
}

/** Builds the signature stored beside a cached plan. */
export function planCacheSignature(request: PlannerRequest): PlanCacheSignature {
  return {
    destination: normalizeDestination(request.destination),
    days: request.days,
    condition: request.condition,
    interests: normalizeCacheText(request.interests),
    budget: request.budget,
    transport: request.transport,
  };
}

/** Builds the broad identity used when an exact preference match is absent. */
export function planCacheIdentity(request: PlannerRequest): PlanCacheIdentity {
  return {
    destination: normalizeDestination(request.destination),
    days: request.days,
    condition: request.condition,
  };
}

/** Canonical exact key for one planner configuration. */
export function buildPlanCacheKey(request: PlannerRequest): string {
  const signature = planCacheSignature(request);
  return [
    `v${CACHE_VERSION}`,
    "plan",
    ENGINE_VERSION,
    signature.destination,
    signature.days,
    signature.condition,
    signature.interests,
    signature.budget,
    signature.transport,
  ].join("|");
}

/** The identity shared by both planner and verification caches. */
export interface SwarmCacheIdentity {
  destination: string;
  condition: Condition;
}

/** Canonical key for one verification configuration. */
export function buildSwarmCacheKey(input: SwarmCacheIdentity): string {
  return [
    `v${CACHE_VERSION}`,
    "swarm",
    normalizeDestination(input.destination),
    input.condition,
  ].join("|");
}

/** Stable destination column value for both cache kinds. */
export function cacheDestination(input: { destination: string }): string {
  return normalizeDestination(input.destination);
}
