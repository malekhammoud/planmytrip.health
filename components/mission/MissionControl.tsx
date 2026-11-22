/**
 * Live mission control for the three TinyFish browser agents.
 *
 * Inputs: the swarm state and run snapshot from useSwarm, the current trip inputs, and
 * retry/re-run actions.
 * Outputs: a status row, one hero live view per worker (all mounted), a tab list of
 * worker tiles, the source ledger, findings, the pre-run state, and the stale-input
 * caution. The chronological activity feed lives in the workspace's persistent rail.
 * Invariants: every visible change comes from an accepted event; no percentage, ETA, or
 * partial finding is invented; nothing ticks while idle; the browser title reflects the
 * real running or verified count; mock runs stay labelled.
 */

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FindingsReveal } from "@/components/mission/FindingsReveal";
import { FocusView } from "@/components/mission/FocusView";
import { PreRun } from "@/components/mission/PreRun";
import { SourcesList } from "@/components/mission/SourcesList";
import { WorkerTile } from "@/components/mission/WorkerTile";
import { MISSION_WORKERS } from "@/components/mission/missionMeta";
import { Button, Callout, Disclosure } from "@/components/ui";
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
  medication: string;
  onRetry: (worker: WorkerId) => void;
  onRerun: () => void;
  /** True once the plan is ready: sources and findings share the full width. */
  expanded?: boolean;
}

function lastProgressAt(state: SwarmState, worker: WorkerId): number {
  const value = state.workers[worker];
  const steps = value.steps;
  return steps[steps.length - 1]?.t ?? value.startedAt ?? 0;
}

/** Most recent active worker, an error when nothing is active, or the newest settled. */
function autoWorker(state: SwarmState): WorkerId {
  const active = WORKER_IDS.filter((worker) => {
    const phase = state.workers[worker].phase;
    return phase === "queued" || phase === "running";
  });
  if (active.length > 0) {
    return active.reduce((best, worker) =>
      lastProgressAt(state, worker) > lastProgressAt(state, best) ? worker : best,
    );
  }
  const failed = WORKER_IDS.filter((worker) => state.workers[worker].phase === "error");
  if (failed.length > 0) {
    return failed.reduce((best, worker) => {
      const score = state.workers[worker].endedAt ?? 0;
      const bestScore = state.workers[best].endedAt ?? 0;
      return score > bestScore ? worker : best;
    });
  }
  return WORKER_IDS.reduce((best, worker) =>
    lastProgressAt(state, worker) > lastProgressAt(state, best) ? worker : best,
  );
}

/** The one mission surface. */
export function MissionControl({
  state,
  runInput,
  destination,
  condition,
  medication,
  onRetry,
  onRerun,
  expanded = false,
}: MissionControlProps) {
  const [pinned, setPinned] = useState<WorkerId | null>(null);
  const [preRunOpen, setPreRunOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const previousTitleRef = useRef<string | null>(null);
  const summary = swarmSummary(state);
  const live = isSwarmLive(state);
  const auto = autoWorker(state);
  const focused = pinned ?? auto;
  const preRun = WORKER_IDS.every((worker) => state.workers[worker].phase === "idle");
  const stale =
    runInput !== null &&
    !preRun &&
    isStale(runInput, { destination, condition, medication });
  const announcement = usePhaseAnnouncement(state);

  useEffect(() => {
    previousTitleRef.current = document.title;
    return () => {
      if (previousTitleRef.current !== null) document.title = previousTitleRef.current;
    };
  }, []);

  useEffect(() => {
    if (live) {
      document.title = `(${summary.running} running) PlanMyTrip.health`;
    } else if (!preRun && summary.completed + summary.failed === 3) {
      document.title = `Verified ${summary.completed}/3 - PlanMyTrip.health`;
    } else {
      document.title = "PlanMyTrip.health";
    }
  }, [live, preRun, summary.completed, summary.failed, summary.running]);

  const select = (worker: WorkerId): void => setPinned(worker);

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = WORKER_IDS.indexOf(focused);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % WORKER_IDS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + WORKER_IDS.length) % WORKER_IDS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = WORKER_IDS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const worker = WORKER_IDS[next];
    if (worker === undefined) return;
    setPinned(worker);
    tabsRef.current
      ?.querySelector<HTMLElement>(`#mission-tab-${worker}`)
      ?.focus();
  };

  return (
    <div>
      {state.mock ? (
        <div className="mb-4">
          <Callout tone="caution" title="Mock data">
            These checks ran in mock mode. The activity, sources, and findings are scripted
            sample data, not live results.
          </Callout>
        </div>
      ) : null}

      {stale ? (
        <div className="mb-4">
          <Callout tone="caution" title="Inputs changed since this verification ran">
            <p>Results may not apply to the current trip.</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={onRerun}>
                Re-run verification
              </Button>
            </div>
          </Callout>
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {preRun ? (
        <Disclosure
          title="What will be checked"
          summary="3 agents · exact instructions"
          open={preRunOpen}
          onToggle={() => setPreRunOpen((current) => !current)}
        >
          <div className="pt-4">
            <PreRun destination={destination} condition={condition} medication={medication} />
          </div>
        </Disclosure>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="t-data-sm text-muted">
              {pinned === null
                ? "Following activity"
                : `Pinned to ${MISSION_WORKERS[pinned].name}`}
            </p>
            {pinned === null ? null : (
              <Button variant="ghost" size="sm" onClick={() => setPinned(null)}>
                Unpin
              </Button>
            )}
          </div>

          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Verification workers"
            onKeyDown={onTabKeyDown}
            className="mt-2 grid grid-cols-1 border-b border-solid border-hairline lg:grid-cols-3"
          >
            {WORKER_IDS.map((worker) => (
              <WorkerTile
                key={worker}
                worker={worker}
                state={state.workers[worker]}
                selected={worker === focused}
                onSelect={() => select(worker)}
              />
            ))}
          </div>

          <div className="mt-4">
            {WORKER_IDS.map((worker) => (
              <FocusView
                key={worker}
                worker={worker}
                state={state.workers[worker]}
                visible={worker === focused}
                onRetry={() => onRetry(worker)}
              />
            ))}
          </div>

          <div className="mt-3">
            <Disclosure
              title="Sources and findings"
              summary={`${MISSION_WORKERS[focused].name} · ${summary.findings}/3 complete`}
              open={evidenceOpen}
              onToggle={() => setEvidenceOpen((current) => !current)}
            >
              <div className={expanded ? "grid gap-x-10 lg:grid-cols-2" : undefined}>
                <SourcesList state={state} worker={focused} />
                <FindingsReveal state={state} worker={focused} dimmed={stale} />
              </div>
            </Disclosure>
          </div>
        </>
      )}
    </div>
  );
}
