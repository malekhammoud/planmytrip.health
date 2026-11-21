"use client";

import { Fragment, type CSSProperties } from "react";
import { WorkerFindings } from "@/components/WorkerFindings";
import { WorkerLivePanel } from "@/components/WorkerLivePanel";
import { Button, Callout, StatusGlyph, type StatusGlyphState } from "@/components/ui";
import { useSwarm } from "@/hooks/useSwarm";
import type { WorkerPhase, WorkerState } from "@/lib/swarmReducer";
import { WORKER_IDS, type WorkerId } from "@/lib/swarmTypes";
import { CONDITION_LABELS, type Condition } from "@/lib/types";

/** Props for {@link AgentSwarmMonitor}, all owned by the page. */
export interface AgentSwarmMonitorProps {
  /** Destination label. An empty value never starts a request. */
  destination: string;
  /** Condition used by the worker goals. */
  condition: Condition;
  /** Medication name; the workers never report doses. */
  medication: string;
  /** Opaque browser run id shared with the planner capture. */
  runId: string;
  /** Anonymous install id. */
  installId: string;
  /** Explicit opt-in for saving verification findings. */
  captureConsent: boolean;
  /** 0 before the first Deploy; each Deploy increments it. */
  runToken: number;
}

interface WorkerMeta {
  /** Worker name in the heading type. */
  name: string;
  /** Source host the worker reads, shown under the name. */
  host: string;
  /** One sentence for the designed empty state. */
  checks: string;
}

const WORKER_META: Record<WorkerId, WorkerMeta> = {
  advisory: {
    name: "Travel advisory",
    host: "travel.gc.ca",
    checks: "Checks the destination risk level, health notices, and environmental hazards.",
  },
  pharmacy: {
    name: "Medication and customs",
    host: "drugs.com",
    checks: "Checks the generic name, local brands, and customs and carry rules.",
  },
  coverage: {
    name: "Emergency medical coverage",
    host: "sunlife.ca",
    checks: "Checks emergency medical limits, pre-authorization, and the checklist.",
  },
};

const PHASE_LABEL: Record<WorkerPhase, string> = {
  idle: "Ready",
  queued: "Preparing",
  running: "Running",
  complete: "Complete",
  error: "Needs retry",
};

const PHASE_GLYPH: Record<WorkerPhase, StatusGlyphState> = {
  idle: "queued",
  queued: "queued",
  running: "running",
  complete: "done",
  error: "error",
};

const PHASE_ACTIVITY: Record<WorkerPhase, string> = {
  idle: "Ready when the next plan runs.",
  queued: "Preparing the browser.",
  running: "Running the live check.",
  complete: "Check complete.",
  error: "This check needs a retry.",
};

function WorkerColumn({
  worker,
  state,
  index,
  onRetry,
}: {
  worker: WorkerId;
  state: WorkerState;
  index: number;
  onRetry: (worker: WorkerId) => void;
}) {
  const meta = WORKER_META[worker];
  const active = state.phase === "queued" || state.phase === "running";
  const latest = state.progress[state.progress.length - 1] ?? PHASE_ACTIVITY[state.phase];
  const previous = state.progress.slice(0, -1);
  const style = { "--swarm-index": index } as CSSProperties;
  return (
    <div
      className="swarm-column min-w-0 border-t border-hairline py-6 lg:border-t-0 lg:px-4 lg:py-0 lg:first:pl-0 lg:last:pr-0"
      style={style}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <StatusGlyph state={PHASE_GLYPH[state.phase]} label={PHASE_LABEL[state.phase]} />
        {state.progress.length > 0 ? (
          <p className="t-data-sm text-muted">
            {state.progress.length} {state.progress.length === 1 ? "signal" : "signals"}
          </p>
        ) : null}
      </div>
      <h3 className="t-heading mt-2 text-ink">{meta.name}</h3>
      <p className="t-data mt-1 text-muted">{meta.host}</p>

      {active ? (
        <>
          <WorkerLivePanel workerName={meta.name} url={state.streamingUrl} />
          <p
            key={latest}
            className="agent-activity t-small mt-3 text-ink [overflow-wrap:anywhere]"
          >
            {latest}
          </p>
          {previous.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-1">
              {previous.map((message, messageIndex) => (
                <li
                  key={`${messageIndex}-${message}`}
                  className="t-data-sm text-muted [overflow-wrap:anywhere]"
                >
                  {message}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {state.phase === "complete" ? <WorkerFindings worker={worker} state={state} /> : null}

      {state.phase === "error" ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="t-small text-risk [overflow-wrap:anywhere]">
            {state.errorMessage ?? "The check could not finish. Retry this worker."}
          </p>
          <Button
            variant="secondary"
            aria-label={`Retry ${meta.name.toLowerCase()} check`}
            onClick={() => onRetry(worker)}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Three rows before the first run: what each agent will check. */
function EmptyState() {
  return (
    <div>
      {WORKER_IDS.map((worker, index) => {
        const meta = WORKER_META[worker];
        const style = { "--swarm-index": index } as CSSProperties;
        return (
          <div
            key={worker}
            className="swarm-column border-t border-hairline py-4"
            style={style}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <StatusGlyph state="queued" label="Ready" />
              <p className="t-heading text-ink">{meta.name}</p>
            </div>
            <p className="t-small mt-1 text-muted">{meta.checks}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Live monitor for the three TinyFish research workers. Token 0 renders the designed
 * empty state and never fetches; each new token resets the workers, snapshots the trip
 * inputs, and starts all three. Findings stay attributed to the snapshot that produced
 * them, and retry redeploys one worker with that same snapshot.
 */
export function AgentSwarmMonitor({
  destination,
  condition,
  medication,
  runId,
  installId,
  captureConsent,
  runToken,
}: AgentSwarmMonitorProps) {
  const { state, runInput, retry } = useSwarm({
    destination,
    condition,
    medication,
    runId,
    installId,
    captureConsent,
    runToken,
  });
  const hasDestination = destination.trim().length > 0;
  const notStarted = WORKER_IDS.every(
    (worker) => state.workers[worker].phase === "idle",
  );
  const completed = WORKER_IDS.filter(
    (worker) => state.workers[worker].phase === "complete",
  ).length;
  const needsRetry = WORKER_IDS.filter(
    (worker) => state.workers[worker].phase === "error",
  ).length;
  const inputsChanged =
    runInput !== null &&
    (destination.trim() !== runInput.destination ||
      condition !== runInput.condition ||
      medication.trim() !== runInput.medication);

  return (
    <div>
      {hasDestination && state.mock ? (
        <div className="mb-6">
          <Callout tone="caution" title="Mock data">
            These checks ran in mock mode. The findings are sample data, not live
            results.
          </Callout>
        </div>
      ) : null}

      {!hasDestination ? (
        <p className="t-small text-muted">Add a destination to run verification.</p>
      ) : (
        <>
          {runInput !== null && !notStarted ? (
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div className="flex flex-col gap-1">
                <p className="t-small text-muted">
                  Last run: {runInput.destination} ·{" "}
                  {CONDITION_LABELS[runInput.condition]} ·{" "}
                  {runInput.medication || "No medication recorded"}
                </p>
                {inputsChanged ? (
                  <p className="t-small text-caution">
                    Inputs changed since this run. Plan again to verify.
                  </p>
                ) : null}
              </div>
              <p className="t-data text-muted">
                {completed} of 3 complete
                {needsRetry > 0 ? ` · ${needsRetry} needs retry` : ""}
              </p>
            </div>
          ) : null}
          {!notStarted ? (
            <p className="sr-only" role="status" aria-live="polite">
              {completed} of 3 checks complete.
              {needsRetry > 0 ? ` ${needsRetry} needs retry.` : ""}
            </p>
          ) : null}

          {notStarted ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)]">
              {WORKER_IDS.map((worker, index) => (
                <Fragment key={worker}>
                  {index === 0 ? null : (
                    <div aria-hidden="true" className="hidden bg-hairline lg:block" />
                  )}
                  <WorkerColumn
                    worker={worker}
                    state={state.workers[worker]}
                    index={index}
                    onRetry={retry}
                  />
                </Fragment>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
