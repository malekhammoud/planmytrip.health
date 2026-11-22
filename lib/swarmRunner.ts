/**
 * Worker execution and lifecycle helpers for POST /api/travel-swarm.
 *
 * Inputs: requested workers, validated goal input, the API key, an emit callback, the
 * request abort signal, and the dev mock flag.
 * Outputs: queued/running status, run start, streaming URL, progress, sources,
 * heartbeats, retry notes, completion, error, and done events for the requested workers.
 * Invariants: each live worker owns one AbortController for its current attempt; a
 * retry is attempted at most once for an invalid schema and once for a blocked site;
 * every path emits exactly one swarm_done with the same counters the stream emitted. The
 * API key is passed only to the TinyFish client and never appears in an event.

 */

import { SWARM_RETRY_NOTES, SWARM_RUN_LIMITS } from "@/lib/swarmConfig";
import {
  WORKER_SCHEMAS,
  WORKER_SOURCES,
  buildWorkerGoal,
  type SwarmGoalInput,
} from "@/lib/swarmGoals";
import { runMockWorker, type MockRunOptions } from "@/lib/swarmMock";
import { TinyfishHttpError, streamTinyfishRun } from "@/lib/tinyfish";
import {
  mapTinyfishErrorCode,
  mapTinyfishEvent,
} from "@/lib/tinyfishEvents";
import type {
  SwarmDoneSummary,
  SwarmErrorCode,
  SwarmEvent,
  WorkerId,
  WorkerOutcome,
} from "@/lib/swarmTypes";

/** Worker timeout before a calm timeout error is emitted. */
export const WORKER_TIMEOUT_MS = SWARM_RUN_LIMITS.clientTimeoutMs;

/** SSE keep-alive interval used by the route. */
export const KEEP_ALIVE_MS = 15_000;

const MISSING_KEY_MESSAGE =
  "The live agent check is not configured on this server. Verify the API key and retry.";

// VERIFY: a SITE_BLOCKED retry with browser_profile "stealth" is accepted by the
// provider and does not double-bill or duplicate side effects. Confirm on the next live
// blocked-site run, then record the result in AGENTS.md section 9.
const TIMEOUT_MESSAGE = "The agent did not finish in time. Retry this check.";
const END_MESSAGE = "The agent stream ended before it reported a result. Retry this check.";
const NETWORK_MESSAGE = "The agent service could not be reached. Retry this check.";

/** Wraps a destination string into the exact error copy for one code. */
const ERROR_MESSAGES: Record<SwarmErrorCode, string> = {
  missing_api_key: MISSING_KEY_MESSAGE,
  timeout: TIMEOUT_MESSAGE,
  site_blocked: "The site blocked the agent. Retry this check.",
  max_steps_exceeded: "The agent hit its step limit before finishing. Retry this check.",
  rate_limit: "TinyFish rate limit reached. Try again in a minute.",
  insufficient_credits: "The TinyFish account has no credits left. Check the plan.",
  invalid_input: "The agent service rejected this check. Retry this worker.",
  forbidden: "The live check is not enabled for this account. Check the TinyFish plan and retry.",
  cancelled: "The agent run was cancelled. Retry this check.",
  upstream_error: "The agent check stopped unexpectedly. Retry this worker.",
};

/** Runtime context shared by every worker in one swarm request. */
export interface SwarmRunContext {
  input: SwarmGoalInput;
  apiKey: string;
  emit: (event: SwarmEvent) => void;
  signal: AbortSignal;
  /** Live worker controllers, so a rejected worker can abort its siblings. */
  workerControllers?: Set<AbortController>;
  /** Called once for every upstream event type this build does not know. */
  onUnknownEvent?: () => void;
}

/** Monotonic per-worker sequence for one request; swarm_done has its own counter. */
export function createSwarmSequence(): (worker: WorkerId | "swarm") => number {
  const counters = new Map<string, number>();
  return (worker) => {
    const next = (counters.get(worker) ?? 0) + 1;
    counters.set(worker, next);
    return next;
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

type Seq = (worker: WorkerId | "swarm") => number;

function workerError(
  worker: WorkerId,
  code: SwarmErrorCode,
  message: string,
  seq: Seq,
  mock = false,
): SwarmEvent {
  return {
    event: "worker_error",
    data: { worker, seq: seq(worker), ts: nowIso(), code, message, mock: mock ? true : undefined },
  };
}

function swarmDone(
  completed: WorkerId[],
  failed: WorkerId[],
  summary: SwarmDoneSummary,
  seq: Seq,
  mock = false,
): SwarmEvent {
  return {
    event: "swarm_done",
    data: {
      worker: "swarm",
      seq: seq("swarm"),
      ts: nowIso(),
      completed,
      failed,
      summary,
      mock: mock ? true : undefined,
    },
  };
}

function queued(worker: WorkerId, seq: Seq, mock: boolean): SwarmEvent {
  return {
    event: "worker_status",
    data: {
      worker,
      seq: seq(worker),
      ts: nowIso(),
      status: "queued",
      mock: mock ? true : undefined,
    },
  };
}

function note(worker: WorkerId, message: string, seq: Seq, mock: boolean): SwarmEvent {
  return {
    event: "worker_note",
    data: { worker, seq: seq(worker), ts: nowIso(), message, mock: mock ? true : undefined },
  };
}

function summarize(outcomes: WorkerOutcome[]): { completed: WorkerId[]; failed: WorkerId[] } {
  return {
    completed: outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.worker),
    failed: outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.worker),
  };
}

interface AttemptOptions {
  withSchema: boolean;
  browserProfile?: "lite" | "stealth";
}

type AttemptResult =
  | { kind: "completed" }
  | { kind: "error" }
  | { kind: "aborted" }
  | { kind: "retry"; retry: "schema" | "stealth" };

async function runAttempt(
  worker: WorkerId,
  context: SwarmRunContext,
  goal: string,
  sourceUrl: string,
  seq: Seq,
  options: AttemptOptions,
  controller: AbortController,
  externalAbort: { reason: "none" | "timeout" | "client" },
): Promise<AttemptResult> {
  context.workerControllers?.add(controller);
  let settled = false;
  return new Promise<AttemptResult>((resolve) => {
    const finish = (result: AttemptResult): void => {
      if (settled) return;
      settled = true;
      context.workerControllers?.delete(controller);
      resolve(result);
    };
    const emitMapped = (event: Parameters<typeof mapTinyfishEvent>[0]): SwarmEvent | null => {
      const mapped = mapTinyfishEvent(event, {
        worker,
        sourceUrl,
        now: nowIso,
        nextSeq: () => seq(worker),
      });
      if (mapped !== null) context.emit(mapped);
      return mapped;
    };

    void streamTinyfishRun({
      apiKey: context.apiKey,
      url: sourceUrl,
      goal,
      outputSchema: options.withSchema ? WORKER_SCHEMAS[worker] : undefined,
      browserProfile: options.browserProfile,
      agentConfig: {
        cursorStyle: SWARM_RUN_LIMITS.cursorStyle,
        maxDurationSeconds: SWARM_RUN_LIMITS.maxDurationSeconds,
      },
      signal: controller.signal,
      onUnknownEvent: () => context.onUnknownEvent?.(),
      onEvent: (event) => {
        if (settled) return;
        if (event.type === "COMPLETE" && event.status !== "COMPLETED") {
          const code = mapTinyfishErrorCode(event.error ?? event.status);
          if (code === "site_blocked" && options.browserProfile !== "stealth") {
            finish({ kind: "retry", retry: "stealth" });
            controller.abort();
            return;
          }
          emitMapped(event);
          finish({ kind: "error" });
          return;
        }
        const mapped = emitMapped(event);
        if (mapped?.event === "worker_complete") finish({ kind: "completed" });
      },
    }).then(
      () => {
        if (settled) return;
        if (!controller.signal.aborted) {
          context.emit(workerError(worker, "upstream_error", END_MESSAGE, seq));
        }
        finish({ kind: "error" });
      },
      (error: unknown) => {
        if (settled) return;
        if (controller.signal.aborted) {
          if (externalAbort.reason === "none") {
            context.emit(workerError(worker, "upstream_error", ERROR_MESSAGES.upstream_error, seq));
            finish({ kind: "error" });
            return;
          }
          finish({ kind: "aborted" });
          return;
        }
        if (error instanceof TinyfishHttpError) {
          const code = mapTinyfishErrorCode(error.code);
          if (code === "invalid_input" && options.withSchema) {
            finish({ kind: "retry", retry: "schema" });
            return;
          }
          if (code === "site_blocked" && options.browserProfile !== "stealth") {
            finish({ kind: "retry", retry: "stealth" });
            return;
          }
          context.emit(workerError(worker, code, ERROR_MESSAGES[code], seq));
          finish({ kind: "error" });
          return;
        }
        context.emit(workerError(worker, "upstream_error", NETWORK_MESSAGE, seq));
        finish({ kind: "error" });
      },
    );
  });
}

async function runLiveWorker(
  worker: WorkerId,
  context: SwarmRunContext,
  seq: Seq,
): Promise<WorkerOutcome> {
  const sourceUrl = WORKER_SOURCES[worker];
  // Build the goal before allocating resources; it may throw on a bad input.
  const goal = buildWorkerGoal(worker, context.input);
  let terminal: boolean | null = null;
  let active: AbortController | null = null;
  const externalAbort: { reason: "none" | "timeout" | "client" } = { reason: "none" };
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveTerminal: (ok: boolean) => void = () => {};
  const terminalPromise = new Promise<boolean>((resolve) => {
    resolveTerminal = resolve;
  });

  const abortFromClient = (): void => {
    externalAbort.reason = "client";
    active?.abort();
    if (terminal === null) {
      terminal = false;
      resolveTerminal(false);
    }
  };

  try {
    if (context.signal.aborted) abortFromClient();
    else context.signal.addEventListener("abort", abortFromClient, { once: true });

    timeoutTimer = setTimeout(() => {
      externalAbort.reason = "timeout";
      if (terminal === null) {
        terminal = false;
        if (!context.signal.aborted) {
          context.emit(workerError(worker, "timeout", TIMEOUT_MESSAGE, seq));
        }
        resolveTerminal(false);
      }
      active?.abort();
    }, WORKER_TIMEOUT_MS);

    let options: AttemptOptions = { withSchema: true };
    let schemaRetried = false;
    let stealthRetried = false;

    while (terminal === null) {
      const controller = new AbortController();
      active = controller;
      const result = await Promise.race<AttemptResult>([
        runAttempt(worker, context, goal, sourceUrl, seq, options, controller, externalAbort),
        terminalPromise.then((): AttemptResult => ({ kind: "aborted" })),
      ]);
      if (terminal !== null) break;
      if (result.kind === "retry") {
        if (result.retry === "schema" && !schemaRetried) {
          schemaRetried = true;
          context.emit(note(worker, SWARM_RETRY_NOTES.schema, seq, false));
          options = { ...options, withSchema: false };
          continue;
        }
        if (result.retry === "stealth" && !stealthRetried) {
          stealthRetried = true;
          context.emit(note(worker, SWARM_RETRY_NOTES.stealth, seq, false));
          options = { ...options, browserProfile: "stealth" };
          continue;
        }
        context.emit(workerError(worker, "site_blocked", ERROR_MESSAGES.site_blocked, seq));
        terminal = false;
        break;
      }
      if (result.kind === "aborted") {
        terminal = false;
        break;
      }
      terminal = result.kind === "completed";
      break;
    }

    if (terminal === null) terminal = false;
    resolveTerminal(terminal);
    return await Promise.race([
      terminalPromise.then((ok): WorkerOutcome => ({ worker, ok })),
      new Promise<WorkerOutcome>((resolve) => {
        if (terminal !== null) resolve({ worker, ok: terminal });
      }),
    ]);
  } finally {
    if (timeoutTimer !== null) clearTimeout(timeoutTimer);
    context.signal.removeEventListener("abort", abortFromClient);
    active?.abort();
  }
}

/**
 * Runs every worker with a per-worker catch. A rejected worker emits one upstream_error,
 * returns a failed outcome, and calls onRejected immediately so siblings are aborted.
 */
async function runAll(
  workers: WorkerId[],
  context: SwarmRunContext,
  seq: Seq,
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
        context.emit(workerError(worker, "upstream_error", ERROR_MESSAGES.upstream_error, seq, mock));
        return { worker, ok: false };
      }
    }),
  );
}

/** The mock scenario is dev-only; the route never enables it in production. */
function mockOptions(): MockRunOptions {
  const rawSpeed = Number.parseFloat(process.env.SWARM_MOCK_SPEED ?? "1");
  const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : 1;
  const fail = process.env.SWARM_MOCK_FAIL;
  return {
    speed,
    failWorker:
      fail === "advisory" || fail === "pharmacy" || fail === "coverage" ? fail : null,
  };
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
  const seq = createSwarmSequence();
  const counters = {
    steps: 0,
    findings: 0,
    unknownEvents: 0,
    sources: new Set<string>(),
  };
  const emit = (event: SwarmEvent): void => {
    if (event.event === "worker_progress") counters.steps += 1;
    if (event.event === "worker_complete") counters.findings += 1;
    if (event.event === "worker_sources") {
      for (const item of event.data.items) {
        counters.sources.add(`${event.data.worker}|${item.url ?? item.title ?? ""}`);
      }
    }
    context.emit(event);
  };
  const runContext: SwarmRunContext = {
    ...context,
    emit,
    onUnknownEvent: () => {
      counters.unknownEvents += 1;
      context.onUnknownEvent?.();
    },
  };
  const summary = (): SwarmDoneSummary => ({
    steps: counters.steps,
    sources: counters.sources.size,
    findings: counters.findings,
    unknownEvents: counters.unknownEvents,
  });

  try {
    if (mock) {
      const options = mockOptions();
      for (const worker of workers) emit(queued(worker, seq, true));
      const outcomes = await runAll(
        workers,
        runContext,
        seq,
        (worker) => runMockWorker(worker, context.input, emit, seq, options),
        true,
      );
      const result = summarize(outcomes);
      emit(swarmDone(result.completed, result.failed, summary(), seq, true));
      return;
    }

    if (context.apiKey === "") {
      for (const worker of workers) {
        emit(workerError(worker, "missing_api_key", MISSING_KEY_MESSAGE, seq));
      }
      emit(swarmDone([], workers, summary(), seq));
      return;
    }

    for (const worker of workers) emit(queued(worker, seq, false));
    const controllers = new Set<AbortController>();
    const liveContext: SwarmRunContext = { ...runContext, workerControllers: controllers };
    const outcomes = await runAll(
      workers,
      liveContext,
      seq,
      (worker) => runLiveWorker(worker, liveContext, seq),
      false,
      () => {
        for (const controller of controllers) controller.abort();
      },
    );
    const result = summarize(outcomes);
    emit(swarmDone(result.completed, result.failed, summary(), seq));
  } catch {
    // Last resort: never close the stream without a terminal frame.
    for (const worker of workers) {
      emit(workerError(worker, "upstream_error", ERROR_MESSAGES.upstream_error, seq, mock));
    }
    emit(swarmDone([], workers, summary(), seq, mock));
  }
}
