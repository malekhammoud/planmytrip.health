/**
 * Account-owned data cleanup for a deletion request.
 *
 * Inputs: one Clerk user id. Outputs: the counts removed from account tables.
 * Invariants: every statement is parameterized; the cleanup is one transaction; anonymous
 * research captures and the shared cache are not touched because they are not owned by
 * the account.
 */

import { ensureSchema, getPool } from "./postgres";

/** Counts returned after one account cleanup. */
export interface DeletedAccountData {
  savedTrips: number;
  usageEvents: number;
}

/**
 * Deletes the saved trips and billing-usage rows owned by one Clerk account. The caller
 * deletes the Clerk user after this succeeds. Running it twice is safe.
 */
export async function deleteAccountData(
  clerkUserId: string,
): Promise<DeletedAccountData> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const trips = await client.query(
      "DELETE FROM saved_trips WHERE clerk_user_id = $1",
      [clerkUserId],
    );
    const usage = await client.query(
      "DELETE FROM billing_usage WHERE clerk_user_id = $1",
      [clerkUserId],
    );
    await client.query("COMMIT");
    return {
      savedTrips: trips.rowCount ?? 0,
      usageEvents: usage.rowCount ?? 0,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction is already closed; rethrow the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}
