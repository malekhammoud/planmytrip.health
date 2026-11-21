/**
 * Applies the PostgreSQL schema.
 *
 * Inputs: DATABASE_URL. Outputs: the idempotent trip_captures and model_runs schema.
 * Invariants: safe to run repeatedly; prints no connection string or credentials.
 */

import { closeDatabase, ensureSchema } from "../lib/db/postgres";

async function main(): Promise<void> {
  await ensureSchema();
  await closeDatabase();
  console.log("database schema ready");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
