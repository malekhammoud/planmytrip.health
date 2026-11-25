/**
 * PostgreSQL persistence for live-plan usage reservations.
 *
 * Inputs: a Clerk user, one metric, an allowance period, and the plan limit.
 * Outputs: the current period count, or one atomic reservation decision.
 * Invariants: a reservation locks the user/metric/period row range, counts and inserts in
 * one transaction, and never exceeds the limit; the event id is generated on the server,
 * so a client-supplied run id cannot manufacture or reuse usage; any database failure is
 * "error" and callers must fail closed. Every query is parameterized.
 */

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ensureSchema, getPool } from "./postgres";

/** Metrics that consume a plan allowance. */
export type BillingMetric = "plan";

/** The result of one atomic reservation attempt. */
export type BillingReservation = "reserved" | "limit" | "error";

function countFrom(value: unknown): number {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return 0;
  const count = (value as Record<string, unknown>).count;
  return typeof count === "number" ? count : 0;
}

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
  return countFrom(result.rows[0]);
}

/**
 * Reserves one live run or refuses without changing the count. The transaction takes an
 * advisory lock scoped to the account, metric, and period before the count, so two
 * simultaneous requests cannot both observe the last allowance. A limit below one denies
 * every request. The server-generated event id makes the stored row a usage event, not a
 * client retry token.
 */
export async function reserveBillingUsage(
  clerkUserId: string,
  metric: BillingMetric,
  periodStart: string,
  limit: number,
  createdAt = new Date().toISOString(),
): Promise<BillingReservation> {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 0;
  let client: PoolClient | null = null;
  try {
    await ensureSchema();
    client = await getPool().connect();
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [`${clerkUserId}|${metric}|${periodStart}`, "billing_usage"],
    );
    const counted = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM billing_usage
       WHERE clerk_user_id = $1 AND metric = $2 AND period_start = $3::date`,
      [clerkUserId, metric, periodStart],
    );
    if (countFrom(counted.rows[0]) >= safeLimit) {
      await client.query("ROLLBACK");
      return "limit";
    }
    await client.query(
      `INSERT INTO billing_usage (
        event_id, clerk_user_id, metric, period_start, created_at
      ) VALUES ($1, $2, $3, $4::date, $5::timestamptz)`,
      [randomUUID(), clerkUserId, metric, periodStart, createdAt],
    );
    await client.query("COMMIT");
    return "reserved";
  } catch {
    if (client !== null) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The transaction is already closed or the connection failed; fail closed.
      }
    }
    return "error";
  } finally {
    client?.release();
  }
}
