import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { billingPeriodStart } from "../billing/plans";
import {
  closeDatabase,
  ensureSchema,
  getPool,
  resetDatabaseForTests,
} from "./postgres";
import {
  countBillingUsage,
  reserveBillingUsage,
} from "./billingUsage";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("billing usage storage", () => {
  beforeEach(async () => {
    await ensureSchema();
    await resetDatabaseForTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("reserves one live run once per user and period", async () => {
    const period = billingPeriodStart("year", new Date("2026-11-23T00:00:00.000Z"));
    expect(period).toBe("2026-01-01");
    expect(await countBillingUsage("user-1", "plan", period)).toBe(0);

    await expect(
      reserveBillingUsage(
        "user-1",
        "plan",
        period,
        1,
        "2026-11-23T10:00:00.000Z",
      ),
    ).resolves.toBe("reserved");
    expect(await countBillingUsage("user-1", "plan", period)).toBe(1);

    await expect(
      reserveBillingUsage(
        "user-1",
        "plan",
        period,
        1,
        "2026-11-23T10:05:00.000Z",
      ),
    ).resolves.toBe("limit");
    expect(await countBillingUsage("user-1", "plan", period)).toBe(1);
    expect(await countBillingUsage("user-2", "plan", period)).toBe(0);
  });

  it("serializes simultaneous reservations so the last allowance is not oversold", async () => {
    const period = "2026-01-01";
    const results = await Promise.all([
      reserveBillingUsage("user-1", "plan", period, 1),
      reserveBillingUsage("user-1", "plan", period, 1),
      reserveBillingUsage("user-1", "plan", period, 1),
    ]);
    expect(results.sort()).toEqual(["limit", "limit", "reserved"]);
    expect(await countBillingUsage("user-1", "plan", period)).toBe(1);
  });

  it("writes a server-generated event id rather than a caller token", async () => {
    const period = "2026-01-01";
    await reserveBillingUsage("user-1", "plan", period, 2);
    await reserveBillingUsage("user-1", "plan", period, 2);
    const result = await getPool().query(
      "SELECT event_id FROM billing_usage WHERE clerk_user_id = $1 ORDER BY event_id",
      ["user-1"],
    );
    expect(result.rows).toHaveLength(2);
    const ids = result.rows.map((row: unknown) =>
      typeof row === "object" && row !== null && "event_id" in row
        ? String(row.event_id)
        : "",
    );
    expect(ids.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it("denies a zero limit and does not count a different calendar year", async () => {
    await expect(
      reserveBillingUsage("user-1", "plan", "2026-01-01", 0),
    ).resolves.toBe("limit");
    expect(await countBillingUsage("user-1", "plan", "2026-01-01")).toBe(0);

    await reserveBillingUsage(
      "user-1",
      "plan",
      "2026-01-01",
      1,
      "2026-11-23T10:00:00.000Z",
    );
    expect(await countBillingUsage("user-1", "plan", "2027-01-01")).toBe(0);
  });
});
