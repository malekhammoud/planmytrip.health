import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { billingPeriodStart } from "../billing/plans";
import { closeDatabase, ensureSchema, resetDatabaseForTests } from "./postgres";
import { countBillingUsage, recordBillingUsage } from "./billingUsage";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("billing usage storage", () => {
  beforeEach(async () => {
    await ensureSchema();
    await resetDatabaseForTests();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("counts one live run once per user and period", async () => {
    const period = billingPeriodStart("year", new Date("2026-11-23T00:00:00.000Z"));
    expect(period).toBe("2026-01-01");
    expect(await countBillingUsage("user-1", "plan", period)).toBe(0);

    await recordBillingUsage(
      "user-1",
      "run-1",
      "plan",
      period,
      "2026-11-23T10:00:00.000Z",
    );
    await recordBillingUsage(
      "user-1",
      "run-1",
      "plan",
      period,
      "2026-11-23T10:00:01.000Z",
    );
    expect(await countBillingUsage("user-1", "plan", period)).toBe(1);

    await recordBillingUsage(
      "user-1",
      "run-2",
      "plan",
      period,
      "2026-11-23T10:05:00.000Z",
    );
    expect(await countBillingUsage("user-1", "plan", period)).toBe(2);
    expect(await countBillingUsage("user-2", "plan", period)).toBe(0);
  });

  it("does not count a different calendar year", async () => {
    await recordBillingUsage(
      "user-1",
      "run-1",
      "plan",
      "2026-01-01",
      "2026-11-23T10:00:00.000Z",
    );
    expect(await countBillingUsage("user-1", "plan", "2027-01-01")).toBe(0);
  });
});
