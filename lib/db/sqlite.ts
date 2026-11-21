/**
 * SQLite connection and schema for the trip-outcome loop.
 *
 * Inputs: PLANMYTRIP_DB_PATH, or the default data/planmytrip.db. Outputs: one lazily
 * opened DatabaseSync with the capture and model-run tables.
 * Invariants: the schema is idempotent; the module is server-only (node:sqlite); tests
 * can reset the singleton and point it at a temporary file or :memory:.
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | null = null;

/** Resolves the database path from the environment or the repository data directory. */
export function databasePath(): string {
  const configured = process.env.PLANMYTRIP_DB_PATH?.trim();
  if (configured !== undefined && configured.length > 0) return configured;
  return join(process.cwd(), "data", "planmytrip.db");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trip_captures (
  run_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  engine_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consent_version INTEGER NOT NULL,
  request_json TEXT NOT NULL,
  engine_json TEXT NOT NULL,
  plan_json TEXT,
  dose_json TEXT NOT NULL,
  features_json TEXT NOT NULL,
  research_json TEXT NOT NULL,
  swarm_json TEXT NOT NULL,
  outcome_json TEXT,
  label_flare INTEGER,
  label_severity TEXT,
  label_care TEXT,
  label_flare_day INTEGER,
  outcome_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trip_captures_install
  ON trip_captures(install_id);
CREATE INDEX IF NOT EXISTS idx_trip_captures_created
  ON trip_captures(created_at);

CREATE TABLE IF NOT EXISTS model_runs (
  model_version TEXT PRIMARY KEY,
  trained_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  source TEXT NOT NULL,
  n INTEGER NOT NULL,
  events INTEGER NOT NULL,
  metrics_json TEXT NOT NULL,
  artifact_json TEXT NOT NULL
);
`;

/** Opens the database once and creates the schema. */
export function getDatabase(): DatabaseSync {
  if (database !== null) return database;
  const path = databasePath();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  database = db;
  return db;
}

/** Closes the connection. Safe to call when none is open. */
export function closeDatabase(): void {
  if (database === null) return;
  try {
    database.close();
  } finally {
    database = null;
  }
}

/** Test helper: closes and clears the singleton so a new path can be used. */
export function resetDatabaseForTests(): void {
  closeDatabase();
}
