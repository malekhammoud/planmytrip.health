/**
 * Next.js server startup hook.
 *
 * Inputs: NEXT_RUNTIME, set by Next.js for each server instance.
 * Outputs: one fire-and-forget OpenCode runtime warmup on the Node runtime.
 * Invariants: the Node-only warmup module is imported dynamically inside register so the
 * edge bundle never sees it; the build phase is skipped; the warmup promise is never
 * awaited; no credentials are read or logged here.
 */

/** Starts the OpenCode warmup without blocking server readiness. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { startPlannerWarmup } = await import("./lib/agent/agentWarmup");
    startPlannerWarmup();
  } catch {
    // Warmup is an optimisation; a failed import must not stop the server.
  }
}
