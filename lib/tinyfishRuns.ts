/**
 * TinyFish run-detail lookup for archived recordings.
 *
 * Inputs: a run id and the server-side API key.
 * Outputs: the presigned video URL when TinyFish has finished writing the recording.
 * Invariants: the key travels only in the request header; the response body never reaches
 * a log or an error message; missing or malformed fields become null.
 */

const RUNS_URL = "https://agent.tinyfish.ai/v1/runs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asVideoUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4_000) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// VERIFY: the run-detail video_url is a presigned recording URL. Confirm its lifetime
// and the provider's permission to archive a copy locally before relying on it.
/** Fetches one run's current detail. Returns null for any non-2xx or malformed body. */
export async function fetchTinyfishRun(
  runId: string,
  apiKey: string,
): Promise<Record<string, unknown> | null> {
  if (runId.trim().length === 0 || apiKey.trim().length === 0) return null;
  try {
    const response = await fetch(`${RUNS_URL}/${encodeURIComponent(runId)}`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

/**
 * Polls the run detail until a recording URL appears. Recordings are written after the
 * run settles, so a short bounded wait is expected.
 */
export async function fetchTinyfishVideoUrl(
  runId: string,
  apiKey: string,
  attempts = 6,
  delayMs = 2_500,
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const run = await fetchTinyfishRun(runId, apiKey);
    const url = asVideoUrl(run?.video_url);
    if (url !== null) return url;
    if (attempt < attempts - 1) await sleep(delayMs);
  }
  return null;
}
