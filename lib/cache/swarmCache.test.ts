/**
 * Verification cache tests against the in-process tier.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { writeCachedSwarm, readCachedSwarm, type SwarmCacheWriteWorker } from "./swarmCache";
import { resetCacheMemory } from "./cacheStore";
import { emptyFindings } from "@/lib/swarmGoals";
import { WORKER_IDS, type WorkerId } from "@/lib/swarmTypes";

const previousMemory = process.env.PLANMYTRIP_CACHE_MEMORY;
const previousDatabase = process.env.DATABASE_URL;

const identity = {
  destination: "London, Ontario",
  condition: "asthma_respiratory" as const,
};

function worker(workerId: WorkerId): SwarmCacheWriteWorker {
  return {
    findings: emptyFindings(workerId),
    sourceUrl: "https://example.com/source",
    retrievedAt: "2026-11-21T19:30:00.000Z",
    sources: [{ url: "https://example.com/source", title: "Source", api: "fetch" }],
    purposes: [{ purpose: "Read the source", tinyfishApi: "fetch" }],
  };
}

function values(): Partial<Record<WorkerId, SwarmCacheWriteWorker>> {
  return Object.fromEntries(WORKER_IDS.map((workerId) => [workerId, worker(workerId)]));
}

describe("verification cache", () => {
  beforeAll(() => {
    process.env.PLANMYTRIP_CACHE_MEMORY = "1";
    delete process.env.DATABASE_URL;
  });
  afterAll(() => {
    if (previousMemory === undefined) delete process.env.PLANMYTRIP_CACHE_MEMORY;
    else process.env.PLANMYTRIP_CACHE_MEMORY = previousMemory;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
  });
  beforeEach(() => resetCacheMemory());

  it("reads every requested worker with real telemetry", async () => {
    await writeCachedSwarm(identity, WORKER_IDS, values(), "2026-11-22T01:00:00.000Z");
    const cached = await readCachedSwarm(identity, WORKER_IDS);
    expect(cached).not.toBeNull();
    expect(cached?.cachedAt).toBe("2026-11-22T01:00:00.000Z");
    expect(cached?.workers.advisory?.sources).toHaveLength(1);
    expect(cached?.workers.advisory?.purposes[0]?.purpose).toBe("Read the source");
    expect(cached?.workers.advisory?.sourceUrl).toBe("https://example.com/source");
  });

  it("serves the requested worker from a complete set", async () => {
    await writeCachedSwarm(identity, WORKER_IDS, values());
    const cached = await readCachedSwarm(identity, ["advisory"]);
    expect(cached?.workers.advisory).toBeDefined();
  });

  it("refuses a set with no stored worker", async () => {
    await writeCachedSwarm(identity, WORKER_IDS, {});
    expect(await readCachedSwarm(identity, WORKER_IDS)).toBeNull();
  });

});
