/**
 * Exports consented, labeled PostgreSQL rows to JSONL for offline training.
 *
 * Inputs: DATABASE_URL and optional --out. Outputs: one TrainingRow per labeled capture.
 * Invariants: only rows with an explicit label are written; no unlabeled row is treated as
 * a negative; the output may contain real outcome data and is gitignored.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { closeDatabase } from "../lib/db/postgres";
import { exportTrainingRows } from "../lib/db/trips";

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function main(): Promise<void> {
  const output = resolve(option("--out", "data/training-rows.jsonl"));
  const rows = await exportTrainingRows();
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : ""));
  await closeDatabase();
  console.log(`labeled rows: ${rows.length}`);
  console.log(`jsonl: ${output}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
