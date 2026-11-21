/**
 * Worker execution and lifecycle helpers for POST /api/travel-swarm.
 *
 * Inputs: requested workers, validated goal input, the API key, an emit callback, the
 * request abort signal, and the dev mock flag.
 * Outputs: queued/running status, streaming URL, progress, completion, error, and done
 * events for the requested workers.
 * Invariants: each live worker has its own AbortController and 240s timeout; a rejected
 * worker becomes one upstream_error and aborts sibling upstreams; every path emits
 * exactly one swarm_done. The API key is passed only to the TinyFish client and never
 * appears in an event.
 */

import {
  WORKER_SCHEMAS,
  WORKER_SOURCES,
  buildWorkerGoal,
  type SwarmGoalInput,
} from "@/lib/swarmGoals";
import { runMockWorker } from "@/lib/swarmMock";
import { TinyfishHttpError, streamTinyfishRun } from "@/lib/tinyfish";
import { mapTinyfishEvent } from "@/lib/tinyfishEvents";
import type {
  SwarmErrorCode,
  SwarmEvent,
  WorkerId,
  WorkerOutcome,
} from "@/lib/swarmTypes";

/** Worker timeout before a calm timeout error is emitted. Live browser runs routinely
 * spend 90-150s navigating advisory and pharmacy sites, so 110s cut valid runs short. */
export const WORKER_TIMEOUT_MS = 240_000;

/** SSE keep-alive interval used by the route. */
export const KEEP_ALIVE_MS = 15_000;

const MISSING_KEY_MESSAGE =
  "The live agent check is not configured on this server. Verify the API key and retry.";
const TIMEOUT_MESSAGE = "The agent did not finish within 4 minutes. Retry this check.";
const UNEXPECTED_MESSAGE = "The agent check stopped unexpectedly. Retry this worker.";
const END_MESSAGES = {
  ended: "The agent stream ended before it reported a result. Retry this check.",
  http: "The agent service returned an error. Retry this check.",
  network: "The agent service could not be reached. Retry this check.",
} as const;

/** Runtime context shared by every worker in one swarm request. */
export interface SwarmRunContext {
  input: SwarmGoalInput;
  apiKey: string;
  emit: (event: SwarmEvent) => void;
  signal: AbortSignal;
  /** Live worker controllers, so a rejected worker can abort its siblings. */
  workerControllers?: Set<AbortController>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function workerError(worker: WorkerId, code: SwarmErrorCode, message: string, mock = false): SwarmEvent {
  return { event: "worker_error", data: { worker, ts: nowIso(), code, message, mock: mock ? true : undefined } };
}

function swarmDone(completed: WorkerId[], failed: WorkerId[], mock = false): SwarmEvent {
  return { event: "swarm_done", data: { worker: "swarm", ts: nowIso(), completed, failed, mock: mock ? true : undefined } };
}

function queued(worker: WorkerId, mock: boolean): SwarmEvent {
  return { event: "worker_status", data: { worker, ts: nowIso(), status: "queued", mock: mock ? true : undefined } };
}

function summarize(outcomes: WorkerOutcome[]): { completed: WorkerId[]; failed: WorkerId[] } {
  return {
    completed: outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.worker),
    failed: outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.worker),
  };
}

async function runLiveWorker(
  worker: WorkerId,
  context: SwarmRunContext,
): Promise<WorkerOutcome> {
  const sourceUrl = WORKER_SOURCES[worker];
  // Build the goal before allocating resources; it may throw on a bad input.
  const goal = buildWorkerGoal(worker, context.input);
  const controller = new AbortController();
  context.workerControllers?.add(controller);
  let terminal: boolean | null = null;
  let timedOut = false;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveTerminal: (ok: boolean) => void = () => {};
  const terminalPromise = new Promise<boolean>((resolve) => {
    resolveTerminal = resolve;
  });

  const settleWithoutTerminal = (reason: "ended" | "http" | "network"): void => {
    if (terminal !== null) return;
    terminal = false;
    if (!timedOut && !context.signal.aborted) {
      context.emit(workerError(worker, "upstream_error", END_MESSAGES[reason]));
    }
    resolveTerminal(false);
  };

  const abortFromClient = (): void => {
    controller.abort();
    if (terminal === null) {
      terminal = false;
      resolveTerminal(false);
    }
  };

  try {
    if (context.signal.aborted) abortFromClient();
    else context.signal.addEventListener("abort", abortFromClient, { once: true });

    const timeoutOutcome = new Promise<WorkerOutcome>((resolve) => {
      timeoutTimer = setTimeout(() => {
        if (terminal === null) {
          terminal = false;
          if (!context.signal.aborted) {
            context.emit(workerError(worker, "timeout", TIMEOUT_MESSAGE));
          }
          resolveTerminal(false);
        }
        timedOut = true;
        controller.abort();
        resolve({ worker, ok: false });
      }, WORKER_TIMEOUT_MS);
    });

    streamTinyfishRun({
      apiKey: context.apiKey,
      url: sourceUrl,
      goal,
      outputSchema: WORKER_SCHEMAS[worker],
      signal: controller.signal,
      onEvent: (event) => {
        if (terminal !== null) return;
        const mapped = mapTinyfishEvent(event, { worker, sourceUrl, now: nowIso });
        if (mapped === null) return;
        context.emit(mapped);
        if (mapped.event === "worker_complete") {
          terminal = true;
          resolveTerminal(true);
        } else if (mapped.event === "worker_error") {
          terminal = false;
          resolveTerminal(false);
        }
      },
    }).then(
      () => settleWithoutTerminal("ended"),
      (error: unknown) => {
        settleWithoutTerminal(error instanceof TinyfishHttpError ? "http" : "network");
      },
    );

    return await Promise.race([
      terminalPromise.then((ok): WorkerOutcome => ({ worker, ok })),
      timeoutOutcome,
    ]);
  } finally {
    if (timeoutTimer !== null) clearTimeout(timeoutTimer);
    context.signal.removeEventListener("abort", abortFromClient);
    context.workerControllers?.delete(controller);
    controller.abort();
  }
}

/**
 * Runs every worker with a per-worker catch. A rejected worker emits one upstream_error,
 * returns a failed outcome, and calls onRejected immediately so siblings are aborted.
 */
async function runAll(
  workers: WorkerId[],
  context: SwarmRunContext,
  run: (worker: WorkerId) => Promise<WorkerOutcome>,
  mock: boolean,
  onRejected?: () => void,
): Promise<WorkerOutcome[]> {
  return Promise.all(
    workers.map(async (worker): Promise<WorkerOutcome> => {
      try {
        return await run(worker);
      } catch {
        onRejected?.();
        context.emit(workerError(worker, "upstream_error", UNEXPECTED_MESSAGE, mock));
        return { worker, ok: false };
      }
    }),
  );
}

/**
 * Runs every requested worker with isolated failures, then emits one swarm_done.
 * Mock mode skips the key check; otherwise a missing key fails each worker cleanly.
 */
export async function runSwarm(
  workers: WorkerId[],
  context: SwarmRunContext,
  mock: boolean,
): Promise<void> {
  try {
    if (mock) {
      for (const worker of workers) context.emit(queued(worker, true));
      const outcomes = await runAll(
        workers,
        context,
        (worker) => runMockWorker(worker, context.input, context.emit),
        true,
      );
      const summary = summarize(outcomes);
      context.emit(swarmDone(summary.completed, summary.failed, true));
      return;
    }

    if (context.apiKey === "") {
      for (const worker of workers) {
        context.emit(workerError(worker, "missing_api_key", MISSING_KEY_MESSAGE));
      }
      context.emit(swarmDone([], workers));
      return;
    }

    for (const worker of workers) context.emit(queued(worker, false));
    const controllers = new Set<AbortController>();
    const liveContext: SwarmRunContext = { ...context, workerControllers: controllers };
    const outcomes = await runAll(
      workers,
      liveContext,
      (worker) => runLiveWorker(worker, liveContext),
      false,
      () => {
        for (const controller of controllers) controller.abort();
      },
    );
    const summary = summarize(outcomes);
    context.emit(swarmDone(summary.completed, summary.failed));
  } catch {
    // Last resort: never close the stream without a terminal frame.
    for (const worker of workers) {
      context.emit(workerError(worker, "upstream_error", UNEXPECTED_MESSAGE, mock));
    }
    context.emit(swarmDone([], workers, mock));
  }
}
