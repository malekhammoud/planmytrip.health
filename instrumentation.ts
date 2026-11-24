/**
 * Next.js server startup hook.
 *
 * Inputs: NEXT_RUNTIME, set by Next.js for each server instance.
 * Outputs: one fire-and-forget OpenCode runtime warmup on the Node runtime, plus
 *          server error intake for the OpenCode Self control plane.
 * Invariants: the Node-only warmup module is imported dynamically inside register so the
 * edge bundle never sees it; the build phase is skipped; the warmup promise is never
 * awaited; no credentials are read or logged here.
 */

import type { Instrumentation } from "next";

/** Starts the OpenCode warmup without blocking server readiness. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { installServerHooks } = await import("./lib/ops/server");
    installServerHooks();
  } catch {
    // Monitoring is fail-open.
  }
  try {
    const { startPlannerWarmup } = await import("./lib/agent/agentWarmup");
    startPlannerWarmup();
  } catch {
    // Warmup is an optimisation; a failed import must not stop the server.
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerEvent } = await import("./lib/ops/server");
  const header = request.headers["x-request-id"];
  const requestId = Array.isArray(header) ? header[0] : header;
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = typeof (error as { digest?: unknown }).digest === "string"
    ? (error as { digest: string }).digest
    : undefined;
  reportServerEvent({
    source: `next.${context.routeType}`,
    severity: "error",
    message: err.message || err.name,
    stack: err.stack,
    route: request.path,
    method: request.method,
    status: 500,
    requestId,
    context: {
      digest,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
  });
};
