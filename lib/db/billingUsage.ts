/**
 * PostgreSQL persistence for plan usage counters.
 *
 * Inputs: a Clerk user, one metric, and a run id. Outputs: the current period count and
 * an idempotent usage event.
 * Invariants: one run contributes at most once per metric and period; every query is
 * parameterized; a missing database never invents usage.
 */

import { ensureSchema, getPool } from "./postgres";

/** Metrics that consume a plan allowance. */
export type BillingMetric = "plan";

/** Number of live plan runs recorded for one account and period. */
export async function countBillingUsage(
  clerkUserId: string,
  metric: BillingMetric,
  periodStart: string,
): Promise<number> {
  await ensureSchema();
  const result = await getPool().query(
    `SELECT COUNT(*)::int AS count
     FROM billing_usage
     WHERE clerk_user_id = $1 AND metric = $2 AND period_start = $3::date`,
    [clerkUserId, metric, periodStart],
  );
  const row: unknown = result.rows[0];
  if (typeof row !== "object" || row === null || Array.isArray(row)) return 0;
  const value = (row as Record<string, unknown>).count;
  return typeof value === "number" ? value : 0;
}

/**
 * Records one live run. The event id makes retries and duplicate terminal frames
 * idempotent; a cache hit and a mock run never call this function.
 */
export async function recordBillingUsage(
  clerkUserId: string,
  runId: string,
  metric: BillingMetric,
  periodStart: string,
  createdAt: string,
): Promise<void> {
  await ensureSchema();
  const eventId = `${clerkUserId}:${metric}:${periodStart}:${runId}`;
  await getPool().query(
    `INSERT INTO billing_usage (
      event_id, clerk_user_id, metric, period_start, created_at
    ) VALUES ($1, $2, $3, $4::date, $5::timestamptz)
    ON CONFLICT (event_id) DO NOTHING`,
    [eventId, clerkUserId, metric, periodStart, createdAt],
  );
}
