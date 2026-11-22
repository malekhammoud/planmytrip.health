/**
 * Verification result cache for the three TinyFish workers.
 *
 * Inputs: a destination, condition, and medication identity plus worker results observed
 * during one live swarm run.
 * Outputs: a complete cached worker set or a merged cache write.
 * Invariants: a hit requires every requested worker; findings pass the same normaliser
 * the route uses; sources and progress lines are bounded real telemetry; recordings are
 * same-origin app paths or https URLs; mock results are never stored.
 */

import { WORKER_SOURCES, normalizeWorkerResult } from "@/lib/swarmGoals";
import { WORKER_IDS, type SwarmFindings, type SwarmSourceItem, type TinyfishApi, type WorkerId } from "@/lib/swarmTypes";
import {
  buildSwarmCacheKey,
  cacheDestination,
  normalizeCacheText,
  type SwarmCacheIdentity,
} from "./cacheKey";
import {
  cacheEnabled,
  readCacheRow,
  touchCacheRow,
  writeCacheRow,
} from "./cacheStore";

const SWARM_TTL_MS = 14 * 24 * 60 * 60 * 1_000;
const SOURCE_LIMIT = 100;
const PURPOSE_LIMIT = 200;

/** One cached worker result with the telemetry that produced it. */
export interface CachedSwarmWorker {
  findings: SwarmFindings;
  sourceUrl: string;
  retrievedAt: string;
  /** Real run start from the live STARTED frame. */
  startedAt?: string;
  /** Real run end from the live completion frame. */
  endedAt?: string;
  sources: readonly SwarmSourceItem[];
  purposes: readonly { purpose: string; tinyfishApi?: TinyfishApi }[];
  rawResult?: string;
  parseError?: string;
  /** Authenticated same-origin recording path, when a recording was archived. */
  recordingUrl?: string;
}

/** A complete cache hit for a requested worker set. */
export interface CachedSwarm {
  workers: Partial<Record<WorkerId, CachedSwarmWorker>>;
  cachedAt: string;
}

/** One worker's live data passed to the cache writer. */
export interface SwarmCacheWriteWorker {
  findings: SwarmFindings;
  sourceUrl: string;
  retrievedAt: string;
  startedAt?: string;
  endedAt?: string;
  sources: readonly SwarmSourceItem[];
  purposes: readonly { purpose: string; tinyfishApi?: TinyfishApi }[];
  rawResult?: string;
  parseError?: string;
  recordingUrl?: string;
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

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function asSourceUrl(value: unknown, worker: WorkerId): string {
  if (typeof value === "string" && value.length <= 2_000 && isHttpUrl(value)) {
    return value;
  }
  return WORKER_SOURCES[worker];
}

function asSources(value: unknown): SwarmSourceItem[] {
  if (!Array.isArray(value)) return [];
  const items: SwarmSourceItem[] = [];
  const seen = new Set<string>();
  for (const entry of value.slice(0, SOURCE_LIMIT)) {
    if (!isRecord(entry)) continue;
    const url =
      typeof entry.url === "string" && entry.url.length <= 2_000 && isHttpUrl(entry.url)
        ? entry.url
        : undefined;
    const title =
      typeof entry.title === "string" && entry.title.trim().length > 0
        ? entry.title.trim().slice(0, 200)
        : undefined;
    const api: TinyfishApi | undefined =
      entry.api === "search" || entry.api === "fetch" ? entry.api : undefined;
    if (api === undefined || (url === undefined && title === undefined)) continue;
    const key = url ?? `title:${title ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      ...(url === undefined ? {} : { url }),
      ...(title === undefined ? {} : { title }),
      api,
    });
  }
  return items;
}

function asPurposes(
  value: unknown,
): { purpose: string; tinyfishApi?: TinyfishApi }[] {
  if (!Array.isArray(value)) return [];
  const purposes: { purpose: string; tinyfishApi?: TinyfishApi }[] = [];
  for (const entry of value.slice(0, PURPOSE_LIMIT)) {
    if (!isRecord(entry) || typeof entry.purpose !== "string") continue;
    const purpose = entry.purpose.trim().slice(0, 200);
    if (purpose.length === 0) continue;
    const tinyfishApi: TinyfishApi | undefined =
      entry.tinyfishApi === "search" || entry.tinyfishApi === "fetch"
        ? entry.tinyfishApi
        : undefined;
    purposes.push({ purpose, ...(tinyfishApi === undefined ? {} : { tinyfishApi }) });
  }
  return purposes;
}

function asRecordingUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 500) return undefined;
  if (/^\/api\/recordings\/[0-9a-f-]{36}$/.test(value)) return value;
  return isHttpUrl(value) ? value : undefined;
}

function workerFrom(value: unknown, worker: WorkerId, cachedAt: string): CachedSwarmWorker | null {
  if (!isRecord(value)) return null;
  const sourceUrl = asSourceUrl(value.sourceUrl, worker);
  const normalized = normalizeWorkerResult(worker, value.findings, sourceUrl);
  const retrievedAt = asIso(value.retrievedAt) ?? cachedAt;
  const startedAt = asIso(value.startedAt);
  const endedAt = asIso(value.endedAt);
  return {
    findings: normalized.findings,
    sourceUrl: normalized.sourceUrl,
    retrievedAt,
    ...(startedAt === null ? {} : { startedAt }),
    ...(endedAt === null ? {} : { endedAt }),
    sources: asSources(value.sources),
    purposes: asPurposes(value.purposes),
    ...(typeof value.rawResult === "string" ? { rawResult: value.rawResult.slice(0, 2_000) } : {}),
    ...(typeof value.parseError === "string" ? { parseError: value.parseError.slice(0, 500) } : {}),
    ...(asRecordingUrl(value.recordingUrl) === undefined
      ? {}
      : { recordingUrl: asRecordingUrl(value.recordingUrl) }),
  };
}

/** Reads a cached worker set only when every requested worker is present. */
export async function readCachedSwarm(
  identity: SwarmCacheIdentity,
  workers: readonly WorkerId[],
): Promise<CachedSwarm | null> {
  if (!cacheEnabled()) return null;
  const row = await readCacheRow(buildSwarmCacheKey(identity));
  if (row === null || !isRecord(row.payload) || !isRecord(row.payload.workers)) {
    return null;
  }
  const cachedAt = asIso(row.payload.cachedAt) ?? row.createdAt;
  const result: Partial<Record<WorkerId, CachedSwarmWorker>> = {};
  for (const worker of workers) {
    const parsed = workerFrom(row.payload.workers[worker], worker, cachedAt);
    if (parsed === null) return null;
    result[worker] = parsed;
  }
  touchCacheRow(row.key);
  return { workers: result, cachedAt };
}

/** Stores a complete live worker set; partial retries are not cached. */
export async function writeCachedSwarm(
  identity: SwarmCacheIdentity,
  workers: readonly WorkerId[],
  values: Partial<Record<WorkerId, SwarmCacheWriteWorker>>,
  now = new Date().toISOString(),
): Promise<void> {
  if (!cacheEnabled()) return;
  if (workers.length !== WORKER_IDS.length) return;
  if (!WORKER_IDS.every((worker) => values[worker] !== undefined)) return;
  const stored: Partial<Record<WorkerId, CachedSwarmWorker>> = {};
  for (const worker of WORKER_IDS) {
    const value = values[worker];
    if (value === undefined) return;
    stored[worker] = {
      ...value,
      sources: value.sources.slice(0, SOURCE_LIMIT),
      purposes: value.purposes.slice(0, PURPOSE_LIMIT),
      ...(value.recordingUrl === undefined
        ? {}
        : { recordingUrl: asRecordingUrl(value.recordingUrl) }),
    };
  }
  const expiresAt = new Date(Date.parse(now) + SWARM_TTL_MS).toISOString();
  await writeCacheRow({
    key: buildSwarmCacheKey(identity),
    kind: "swarm",
    columns: {
      destination: cacheDestination(identity),
      days: null,
      condition: identity.condition,
      medication: normalizeCacheText(identity.medication),
      interests: "",
      budget: "",
      transport: "",
    },
    payload: { workers: stored, cachedAt: now },
    createdAt: now,
    expiresAt,
  });
  console.info("[cache] stored a verification result");
}
