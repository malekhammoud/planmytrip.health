/**
 * TinyFish run-detail lookup for stream recovery.
 *
 * Inputs: a run id and the server-side API key.
 * Outputs: the authoritative run record when TinyFish has one, or null.
 * Invariants: the key travels only in the request header; the response body never reaches
 * a log or an error message; missing or malformed fields become null.
 */

const RUNS_URL = "https://agent.tinyfish.ai/v1/runs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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


