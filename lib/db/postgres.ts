/**
 * PostgreSQL connection and schema for captures, saved trips, billing usage, and model runs.
 *
 * Inputs: DATABASE_URL, optionally DATABASE_SSL=true. Outputs: one lazily opened Pool
 * with an idempotent schema.
 * Invariants: server-only; no connection is opened at import time; every query goes
 * through parameterized SQL; JSON columns are JSONB, labels are explicit, and the schema
 * is safe to apply repeatedly.
 */

import { Pool } from "pg";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trip_captures (
  run_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  consent_version INTEGER NOT NULL,
  request_json JSONB NOT NULL,
  engine_json JSONB NOT NULL,
  plan_json JSONB,
  dose_json JSONB NOT NULL,
  features_json JSONB NOT NULL,
  research_json JSONB NOT NULL,
  swarm_json JSONB NOT NULL,
  outcome_json JSONB,
  label_flare BOOLEAN,
  label_severity TEXT,
  label_care TEXT,
  label_flare_day INTEGER,
  outcome_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trip_captures_install
  ON trip_captures(install_id);
CREATE INDEX IF NOT EXISTS idx_trip_captures_created
  ON trip_captures(created_at);

CREATE TABLE IF NOT EXISTS model_runs (
  model_version TEXT PRIMARY KEY,
  trained_at TIMESTAMPTZ NOT NULL,
  schema_version INTEGER NOT NULL,
  source TEXT NOT NULL,
  n INTEGER NOT NULL,
  events INTEGER NOT NULL,
  metrics_json JSONB NOT NULL,
  artifact_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_trips (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  destination TEXT NOT NULL,
  days INTEGER NOT NULL,
  condition TEXT NOT NULL,
  trip_json JSONB NOT NULL,
  plan_json JSONB NOT NULL,
  UNIQUE (clerk_user_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_trips_user
  ON saved_trips(clerk_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS trip_cache (
  cache_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  destination_norm TEXT NOT NULL,
  days INTEGER,
  condition TEXT,
  medication_norm TEXT,
  interest_norm TEXT,
  budget TEXT,
  transport TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trip_cache_lookup
  ON trip_cache(kind, destination_norm, days, condition, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_cache_expiry
  ON trip_cache(expires_at);

CREATE TABLE IF NOT EXISTS billing_usage (
  event_id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  period_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_user
  ON billing_usage(clerk_user_id, metric, period_start);
`;

function connectionString(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured === undefined || configured.length === 0) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return configured;
}

function readTimeoutMs(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw.length === 0) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1_000 ? Math.trunc(value) : fallback;
}

/** Opens the pool once. The schema is applied before the first query. */
export function getPool(): Pool {
  if (pool !== null) return pool;
  const ssl =
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: true }
      : undefined;
  pool = new Pool({
    connectionString: connectionString(),
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    // A hung query must not pin a pool client or an SSE stream forever. Both limits are
    // enforced by the driver and PostgreSQL; the terminal stream frame is additionally
    // bounded by the route's short write grace.
    statement_timeout: readTimeoutMs("DATABASE_STATEMENT_TIMEOUT_MS", 10_000),
    query_timeout: readTimeoutMs("DATABASE_QUERY_TIMEOUT_MS", 10_000),
    application_name: "planmytrip.health",
    ...(ssl === undefined ? {} : { ssl }),
  });
  // An idle client can fail (for example after a database restart). Without a listener
  // Node treats the pool's 'error' event as fatal. The pool replaces the client itself;
  // log no connection details, credentials, or host names.
  pool.on("error", () => {
    console.warn("[db] an idle database client failed and was replaced");
  });
  return pool;
}

/** Applies the idempotent schema once per process. */
export async function ensureSchema(): Promise<void> {
  if (schemaReady === null) {
    schemaReady = getPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

/** Closes the pool. Safe to call when none is open. */
export async function closeDatabase(): Promise<void> {
  const current = pool;
  pool = null;
  schemaReady = null;
  if (current !== null) await current.end();
}

/** Test helper: clears capture, cache, saved-trip, and billing rows without dropping the schema. */
export async function resetDatabaseForTests(): Promise<void> {
  await ensureSchema();
  await getPool().query(
    "TRUNCATE TABLE trip_captures, model_runs, saved_trips, trip_cache, billing_usage",
  );
}
