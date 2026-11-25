/**
 * Archives TinyFish recordings and writes the verification cache entry.
 *
 * Inputs: one complete live swarm result, the run id per worker, and the API key.
 * Outputs: a cached worker set whose recording URLs point at authenticated local files.
 * Invariants: recording failures never block the cache write; the API key never leaves the
 * run-detail request; only a complete worker set is stored.
 */

import type { WorkerId } from "@/lib/swarmTypes";
import type { SwarmCacheIdentity } from "./cacheKey";
import type { SwarmCacheWriteWorker } from "./swarmCache";
import { writeCachedSwarm } from "./swarmCache";
import { archiveRecording, newRecordingId } from "./recordings";
import { fetchTinyfishVideoUrl } from "@/lib/tinyfishRuns";

/** Everything one archive pass needs. */
export interface SwarmArchiveInput {
  identity: SwarmCacheIdentity;
  workers: readonly WorkerId[];
  values: Partial<Record<WorkerId, SwarmCacheWriteWorker>>;
  runIds: Partial<Record<WorkerId, string>>;
  apiKey: string;
  now?: string;
}

/** Downloads available recordings, then stores the complete worker set. */
export async function archiveSwarmCache(input: SwarmArchiveInput): Promise<void> {
  const values: Partial<Record<WorkerId, SwarmCacheWriteWorker>> = { ...input.values };
  if (process.env.TINYFISH_RECORDING === "1" && input.apiKey.length > 0) {
    await Promise.all(
      input.workers.map(async (worker) => {
        const runId = input.runIds[worker];
        const value = values[worker];
        if (runId === undefined || value === undefined) return;
        const videoUrl = await fetchTinyfishVideoUrl(runId, input.apiKey);
        if (videoUrl === null) return;
        const path = await archiveRecording(videoUrl, newRecordingId());
        if (path !== null) values[worker] = { ...value, recordingUrl: path };
      }),
    );
  }
  await writeCachedSwarm(input.identity, input.workers, values, input.now);
}
