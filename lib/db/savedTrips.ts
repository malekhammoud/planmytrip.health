/**
 * PostgreSQL persistence for account-owned saved trips.
 *
 * Inputs: a Clerk user id and a validated trip/plan snapshot. Outputs: saved-trip
 * summaries and complete snapshots owned by that user.
 * Invariants: every query is scoped by clerk_user_id; rows are upserted by
 * (clerk_user_id, run_id); stored JSON is revalidated before it reaches a page.
 */

import { randomUUID } from "node:crypto";
import type { SaveTripInput, SavedTrip, SavedTripSummary } from "../savedTrips";
import { parseSaveTripBody } from "../savedTrips";
import { isCondition } from "../types";
import { ensureSchema, getPool } from "./postgres";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 30;
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function boundedOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.min(1_000_000, Math.trunc(offset)));
}

function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toSummary(value: unknown): SavedTripSummary | null {
  if (!isRecord(value)) return null;
  const savedAt = asIso(value.updated_at);
  if (
    typeof value.id !== "string" ||
    typeof value.destination !== "string" ||
    typeof value.days !== "number" ||
    !isCondition(value.condition) ||
    savedAt === null
  ) {
    return null;
  }
  return {
    id: value.id,
    destination: value.destination,
    days: value.days,
    condition: value.condition,
    savedAt,
  };
}

/**
 * Inserts one snapshot or updates the same run's snapshot for the same account. The
 * browser run id makes repeated saves idempotent without letting one account overwrite
 * another account's row.
 */
export async function saveTrip(
  clerkUserId: string,
  input: SaveTripInput,
): Promise<{ id: string }> {
  await ensureSchema();
  const result = await getPool().query(
    `INSERT INTO saved_trips (
      id, clerk_user_id, run_id, created_at, updated_at,
      destination, days, condition, trip_json, plan_json
    ) VALUES ($1, $2, $3, $4::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9)
    ON CONFLICT (clerk_user_id, run_id) DO UPDATE SET
      updated_at = EXCLUDED.updated_at,
      destination = EXCLUDED.destination,
      days = EXCLUDED.days,
      condition = EXCLUDED.condition,
      trip_json = EXCLUDED.trip_json,
      plan_json = EXCLUDED.plan_json
    RETURNING id`,
    [
      randomUUID(),
      clerkUserId,
      input.runId,
      input.savedAt,
      input.trip.destination,
      input.trip.days,
      input.trip.condition,
      JSON.stringify(input.trip),
      JSON.stringify(input.plan),
    ],
  );
  const row: unknown = result.rows[0];
  if (!isRecord(row) || typeof row.id !== "string") {
    throw new Error("The saved trip could not be stored.");
  }
  return { id: row.id };
}

/** Number of saved trips owned by one account. */
export async function countSavedTrips(clerkUserId: string): Promise<number> {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT COUNT(*)::int AS count FROM saved_trips WHERE clerk_user_id = $1",
    [clerkUserId],
  );
  const row: unknown = result.rows[0];
  if (!isRecord(row) || typeof row.count !== "number") return 0;
  return row.count;
}

/** Finds the saved row for one browser run, used to allow idempotent re-saves. */
export async function findSavedTripForRun(
  clerkUserId: string,
  runId: string,
): Promise<string | null> {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT id FROM saved_trips WHERE clerk_user_id = $1 AND run_id = $2",
    [clerkUserId, runId],
  );
  const row: unknown = result.rows[0];
  return isRecord(row) && typeof row.id === "string" ? row.id : null;
}

/** Lists one account's recent saved trips, newest first, with a bounded page offset. */
export async function listSavedTrips(
  clerkUserId: string,
  limit = 30,
  offset = 0,
): Promise<SavedTripSummary[]> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT id, destination, days, condition, updated_at
     FROM saved_trips
     WHERE clerk_user_id = $1
     ORDER BY updated_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [clerkUserId, boundedLimit(limit), boundedOffset(offset)],
  );
  return result.rows
    .map(toSummary)
    .filter((trip): trip is SavedTripSummary => trip !== null);
}

/** Reads one saved trip owned by this account, revalidating its stored JSON. */
export async function getSavedTrip(
  clerkUserId: string,
  id: string,
): Promise<SavedTrip | null> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT id, run_id, destination, days, condition, updated_at, trip_json, plan_json
     FROM saved_trips
     WHERE id = $1 AND clerk_user_id = $2`,
    [id, clerkUserId],
  );
  const row: unknown = result.rows[0];
  if (!isRecord(row)) return null;
  const savedAt = asIso(row.updated_at);
  const idValue = typeof row.id === "string" ? row.id : null;
  const runId = typeof row.run_id === "string" ? row.run_id : null;
  if (savedAt === null || idValue === null || runId === null) return null;
  const parsed = parseSaveTripBody(
    {
      runId,
      trip: parseJson(row.trip_json),
      plan: parseJson(row.plan_json),
    },
    savedAt,
  );
  if (parsed === null) return null;
  return {
    id: idValue,
    destination: parsed.trip.destination,
    days: parsed.trip.days,
    condition: parsed.trip.condition,
    savedAt,
    runId: parsed.runId,
    trip: parsed.trip,
    plan: parsed.plan,
  };
}

/** Deletes one saved trip owned by this account. Returns false when it is unknown. */
export async function deleteSavedTrip(
  clerkUserId: string,
  id: string,
): Promise<boolean> {
  await ensureSchema();
  const result = await getPool().query(
    "DELETE FROM saved_trips WHERE id = $1 AND clerk_user_id = $2",
    [id, clerkUserId],
  );
  return (result.rowCount ?? 0) > 0;
}
