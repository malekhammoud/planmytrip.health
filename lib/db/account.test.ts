import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, ensureSchema, getPool, resetDatabaseForTests } from "./postgres";
import { deleteAccountData } from "./account";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("account data deletion", () => {
  beforeEach(async () => {
    await ensureSchema();
    await resetDatabaseForTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  async function seed(userId: string, suffix: string): Promise<void> {
    await getPool().query(
      `INSERT INTO saved_trips (
        id, clerk_user_id, run_id, created_at, updated_at,
        destination, days, condition, trip_json, plan_json
      ) VALUES ($1, $2, $3, now(), now(), $4, 4, 'asthma_respiratory', '{}', '{}')`,
      [`trip-${suffix}`, userId, `run-${suffix}`, "London, Ontario"],
    );
    await getPool().query(
      `INSERT INTO billing_usage (
        event_id, clerk_user_id, metric, period_start, created_at
      ) VALUES ($1, $2, 'plan', '2026-01-01', now())`,
      [`usage-${suffix}`, userId],
    );
  }

  it("removes only the account's rows and is idempotent", async () => {
    await seed("user-1", "one");
    await seed("user-2", "two");

    await expect(deleteAccountData("user-1")).resolves.toEqual({
      savedTrips: 1,
      usageEvents: 1,
    });
    await expect(deleteAccountData("user-1")).resolves.toEqual({
      savedTrips: 0,
      usageEvents: 0,
    });

    const remaining = await getPool().query(
      "SELECT clerk_user_id FROM saved_trips ORDER BY clerk_user_id",
    );
    expect(remaining.rows).toEqual([{ clerk_user_id: "user-2" }]);
    const usage = await getPool().query(
      "SELECT clerk_user_id FROM billing_usage ORDER BY clerk_user_id",
    );
    expect(usage.rows).toEqual([{ clerk_user_id: "user-2" }]);
  });
});
