/**
 * Two-tier storage for planner and verification cache entries.
 *
 * Inputs: a canonical cache key, a JSON payload, and the columns used for a related
 * planner lookup.
 * Outputs: unexpired rows from an in-process map or PostgreSQL, plus best-effort writes.
 * Invariants: the database is optional; a missing or failed database never breaks a live
 * run; an entry is returned only before its expiry; no user identity or secret is stored
 * or logged.
 */

import { ensureSchema, getPool } from "@/lib/db/postgres";
import type { Condition } from "@/lib/types";

/** A stored cache row after JSON parsing. */
export interface CacheRow {
  key: string;
  kind: "plan" | "swarm";
  payload: unknown;
  createdAt: string;
  expiresAt: string;
}

/** Extra indexed fields for plan rows; unused values are null. */
export interface CacheColumns {
  destination: string;
  days: number | null;
  condition: Condition | null;
  medication: string;
  interests: string;
  budget: string;
  transport: string;
}

/** One row to persist. */
export interface CacheWrite {
  key: string;
  kind: "plan" | "swarm";
  columns: CacheColumns;
  payload: unknown;
  createdAt: string;
  expiresAt: string;
}

interface MemoryEntry {
  row: CacheRow;
  expiresAtMs: number;
}

const MEMORY_LIMIT = 40;
const memory = new Map<string, MemoryEntry>();

function memoryEnabled(): boolean {
  if (process.env.PLANMYTRIP_CACHE_MEMORY === "0") return false;
  if (process.env.PLANMYTRIP_CACHE_MEMORY === "1") return true;
  // Production keeps a small process tier over Postgres. Tests without an explicit
  // override stay memory-free so one route test cannot seed the next.
  return databaseEnabled() && process.env.NODE_ENV !== "test";
}

function databaseEnabled(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return url !== undefined && url.length > 0;
}

/** True when any cache tier is configured. */
export function cacheEnabled(): boolean {
  if (process.env.PLANMYTRIP_CACHE === "0") return false;
  return databaseEnabled() || memoryEnabled();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function toRow(value: unknown): CacheRow | null {
  if (!isRecord(value)) return null;
  const key = typeof value.cache_key === "string" ? value.cache_key : null;
  const kind = value.kind === "plan" || value.kind === "swarm" ? value.kind : null;
  const createdAt = asIso(value.created_at);
  const expiresAt = asIso(value.expires_at);
  if (key === null || kind === null || createdAt === null || expiresAt === null) {
    return null;
  }
  return { key, kind, payload: value.payload, createdAt, expiresAt };
}

function remember(row: CacheRow): void {
  if (!memoryEnabled()) return;
  const expiresAtMs = Date.parse(row.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return;
  if (memory.size >= MEMORY_LIMIT && !memory.has(row.key)) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(row.key, { row, expiresAtMs });
}

function fromMemory(key: string): CacheRow | null {
  if (!memoryEnabled()) return null;
  const entry = memory.get(key);
  if (entry === undefined) return null;
  if (entry.expiresAtMs <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.row;
}

/** Clears the process cache; used by tests and the seed script. */
export function resetCacheMemory(): void {
  memory.clear();
}

/** Reads one unexpired row by key. */
export async function readCacheRow(key: string): Promise<CacheRow | null> {
  const cached = fromMemory(key);
  if (cached !== null) return cached;
  if (!databaseEnabled()) return null;
  try {
    await ensureSchema();
    const result = await getPool().query(
      `SELECT cache_key, kind, payload, created_at, expires_at
       FROM trip_cache
       WHERE cache_key = $1 AND expires_at > now()`,
      [key],
    );
    const row = toRow(result.rows[0]);
    if (row !== null) remember(row);
    return row;
  } catch {
    console.warn("[cache] a database read failed");
    return null;
  }
}

/** Finds the newest unexpired plan for a destination, day count, condition, and medication. */
export async function readPlanRowByIdentity(input: {
  destination: string;
  days: number;
  condition: Condition;
  medication: string;
}): Promise<CacheRow | null> {
  if (!databaseEnabled()) return null;
  try {
    await ensureSchema();
    const result = await getPool().query(
      `SELECT cache_key, kind, payload, created_at, expires_at
       FROM trip_cache
       WHERE kind = 'plan'
         AND destination_norm = $1
         AND days = $2
         AND condition = $3
         AND medication_norm = $4
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.destination, input.days, input.condition, input.medication],
    );
    const row = toRow(result.rows[0]);
    if (row !== null) remember(row);
    return row;
  } catch {
    console.warn("[cache] a database lookup failed");
    return null;
  }
}

/**
 * Inserts or replaces a cache row. A swarm write merges its `workers` object into the
 * existing payload, so a single-worker retry never erases its cached siblings.
 */
export async function writeCacheRow(input: CacheWrite): Promise<void> {
  const row: CacheRow = {
    key: input.key,
    kind: input.kind,
    payload: input.payload,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  };
  remember(row);
  if (!databaseEnabled()) return;
  try {
    await ensureSchema();
    await getPool().query(
      `INSERT INTO trip_cache (
        cache_key, kind, destination_norm, days, condition, medication_norm,
        interest_norm, budget, transport, payload, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
      ON CONFLICT (cache_key) DO UPDATE SET
        destination_norm = EXCLUDED.destination_norm,
        days = EXCLUDED.days,
        condition = EXCLUDED.condition,
        medication_norm = EXCLUDED.medication_norm,
        interest_norm = EXCLUDED.interest_norm,
        budget = EXCLUDED.budget,
        transport = EXCLUDED.transport,
        payload = CASE
          WHEN EXCLUDED.kind = 'swarm'
            AND jsonb_typeof(trip_cache.payload->'workers') = 'object'
            AND jsonb_typeof(EXCLUDED.payload->'workers') = 'object'
          THEN jsonb_set(
            EXCLUDED.payload,
            '{workers}',
            (trip_cache.payload->'workers') || (EXCLUDED.payload->'workers'),
            true
          )
          ELSE EXCLUDED.payload
        END,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at`,
      [
        input.key,
        input.kind,
        input.columns.destination,
        input.columns.days,
        input.columns.condition,
        input.columns.medication,
        input.columns.interests,
        input.columns.budget,
        input.columns.transport,
        JSON.stringify(input.payload),
        input.createdAt,
        input.expiresAt,
      ],
    );
  } catch {
    console.warn("[cache] a database write failed");
  }
}

/** Records a hit without delaying the response. */
export function touchCacheRow(key: string): void {
  if (!databaseEnabled()) return;
  void ensureSchema()
    .then(() =>
      getPool().query(
        "UPDATE trip_cache SET hits = hits + 1, last_hit_at = now() WHERE cache_key = $1",
        [key],
      ),
    )
    .catch(() => {
      // Hit counters are observability only.
    });
}
