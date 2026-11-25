/**
 * The destination check surface.
 *
 * Inputs: the swarm state and run snapshot from useSwarm, the current trip inputs, and
 * retry/re-run actions.
 * Outputs: a pre-run row, one compact running card, completed findings with provenance,
 * a cached-date note, a stale-input caution, and the re-run action. The chronological
 * activity feed lives in the workspace's persistent rail.
 * Invariants: every visible change comes from an accepted event; no percentage, ETA, step
 * count, or partial finding is invented; nothing ticks while idle; the browser title
 * reflects only checking, checked, or the plain product name; sample runs stay labelled.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { FindingsReveal } from "@/components/mission/FindingsReveal";
import { FocusView } from "@/components/mission/FocusView";
import { PreRun } from "@/components/mission/PreRun";
import { SourcesList } from "@/components/mission/SourcesList";
import {
  MISSION_WORKERS,
  checkTitle,
  formatCheckedDate,
} from "@/components/mission/missionMeta";
import { Button, Callout, Disclosure, StatusGlyph } from "@/components/ui";
import type { SwarmRunInput } from "@/hooks/useSwarm";
import { usePhaseAnnouncement } from "@/hooks/usePhaseAnnouncement";
import type { SwarmState } from "@/lib/swarmReducer";
import { isStale, isSwarmLive, swarmSummary } from "@/lib/swarmTelemetry";
import { WORKER_IDS, type WorkerId } from "@/lib/swarmTypes";
import type { Condition } from "@/lib/types";

/** Props for {@link MissionControl}. */
export interface MissionControlProps {
  state: SwarmState;
  runInput: SwarmRunInput | null;
  destination: string;
  condition: Condition;
  onRetry: (worker: WorkerId) => void;
  onRerun: () => void;
  /** Kept for the workspace layout; the consumer surface always reads as one column. */
  expanded?: boolean;
}

/** The one destination check surface. */
export function MissionControl({
  state,
  runInput,
  destination,
  condition,
  onRetry,
  onRerun,
}: MissionControlProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const previousTitleRef = useRef<string | null>(null);
  const worker = WORKER_IDS[0];
  const meta = MISSION_WORKERS[worker];
  const workerState = state.workers[worker];
  const phase = workerState.phase;
  const summary = swarmSummary(state);
  const live = isSwarmLive(state);
  const preRun = phase === "idle";
  const stale =
    runInput !== null && !preRun && isStale(runInput, { destination, condition });
  const announcement = usePhaseAnnouncement(state);

  useEffect(() => {
    previousTitleRef.current = document.title;
    return () => {
      if (previousTitleRef.current !== null) document.title = previousTitleRef.current;
    };
  }, []);

  useEffect(() => {
    if (live) {
      document.title = "Checking destination - PlanMyTrip.health";
    } else if (phase === "complete") {
      document.title = "Destination checked - PlanMyTrip.health";
    } else {
      document.title = "PlanMyTrip.health";
    }
  }, [live, phase]);

  return (
    <div>
      {state.mock ? (
        <div className="mb-4">
          <Callout tone="caution" title="Sample result">
            This check used sample data, not the live page. The facts and sources are
            scripted for the demo.
          </Callout>
        </div>
      ) : null}

      {state.cachedAt !== null ? (
        <div className="mb-4">
          <Callout
            tone="info"
            title={`Checked ${formatCheckedDate(state.cachedAt)}`}
          >
            These findings are a saved result. Pages may have changed since then.
          </Callout>
        </div>
      ) : null}

      {stale ? (
        <div className="mb-4">
          <Callout tone="caution" title="This check used older trip details">
            <p>The destination or health profile changed after it ran.</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={onRerun}>
                Re-run check
              </Button>
            </div>
          </Callout>
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {preRun ? (
        <PreRun />
      ) : phase === "complete" ? (
        <div className="overflow-hidden rounded-frame border border-solid border-hairline-strong bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-solid border-hairline px-4 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <StatusGlyph state="done" label={checkTitle(phase, meta.host)} />
              <p className="t-data-sm text-muted">{meta.name}</p>
            </div>
            <p className="t-data-sm text-muted">
              {summary.sources} {summary.sources === 1 ? "source" : "sources"}
            </p>
          </div>
          <div className="px-4 py-4">
            {workerState.findings === null ? (
              <p className="t-small text-muted">
                No findings were returned. Re-run the check to try again.
              </p>
            ) : (
              <FindingsReveal state={state} worker={worker} />
            )}

            {summary.sources > 0 ? (
              <div className="mt-4">
                <Disclosure
                  title="Sources"
                  summary={`${summary.sources} ${summary.sources === 1 ? "source" : "sources"}`}
                  open={sourcesOpen}
                  onToggle={() => setSourcesOpen((current) => !current)}
                >
                  <div className="pt-3">
                    <SourcesList state={state} />
                  </div>
                </Disclosure>
              </div>
            ) : null}

            {stale ? null : (
              <div className="mt-4">
                <Button variant="secondary" onClick={onRerun}>
                  Re-run check
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <FocusView
          worker={worker}
          state={workerState}
          visible
          onRetry={() => onRetry(worker)}
        />
      )}
    </div>
  );
}
