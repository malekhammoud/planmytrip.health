/**
 * PostgreSQL connection and schema for the trip-outcome loop and model runs.
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
`;

function connectionString(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured === undefined || configured.length === 0) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return configured;
}

/** Opens the pool once. The schema is applied before the first query. */
export function getPool(): Pool {
  if (pool !== null) return pool;
  const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;
  pool = new Pool({
    connectionString: connectionString(),
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    application_name: "planmytrip.health",
    ...(ssl === undefined ? {} : { ssl }),
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

/** Test helper: clears capture and model rows without dropping the schema. */
export async function resetDatabaseForTests(): Promise<void> {
  await ensureSchema();
  await getPool().query("TRUNCATE TABLE trip_captures, model_runs");
}
