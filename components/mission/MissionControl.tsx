/**
 * Live mission control for the TinyFish browser agent.
 *
 * Inputs: the swarm state and run snapshot from useSwarm, the current trip inputs, and
 * retry/re-run actions.
 * Outputs: a status row, one hero live view, the source ledger, findings, the pre-run
 * state, and the stale-input caution. The chronological activity feed lives in the
 * workspace's persistent rail.
 * Invariants: every visible change comes from an accepted event; no percentage, ETA, or
 * partial finding is invented; nothing ticks while idle; the browser title reflects the
 * real running or verified count; mock runs stay labelled.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { FindingsReveal } from "@/components/mission/FindingsReveal";
import { FocusView } from "@/components/mission/FocusView";
import { PreRun } from "@/components/mission/PreRun";
import { SourcesList } from "@/components/mission/SourcesList";
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
  onRetry: (worker: WorkerId) => void;
  onRerun: () => void;
  /** True once the plan is ready: sources and findings share the full width. */
  expanded?: boolean;
}

/** The one mission surface. */
export function MissionControl({
  state,
  runInput,
  destination,
  condition,
  onRetry,
  onRerun,
  expanded = false,
}: MissionControlProps) {
  const [preRunOpen, setPreRunOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const previousTitleRef = useRef<string | null>(null);
  const summary = swarmSummary(state);
  const live = isSwarmLive(state);
  const worker = WORKER_IDS[0];
  const preRun = state.workers[worker].phase === "idle";
  const stale =
    runInput !== null &&
    !preRun &&
    isStale(runInput, { destination, condition });
  const announcement = usePhaseAnnouncement(state);

  useEffect(() => {
    previousTitleRef.current = document.title;
    return () => {
      if (previousTitleRef.current !== null) document.title = previousTitleRef.current;
    };
  }, []);

  useEffect(() => {
    if (live) {
      document.title = `(1 running) PlanMyTrip.health`;
    } else if (!preRun && summary.completed + summary.failed >= WORKER_IDS.length) {
      document.title = `Verified ${summary.completed}/${WORKER_IDS.length} - PlanMyTrip.health`;
    } else {
      document.title = "PlanMyTrip.health";
    }
  }, [live, preRun, summary.completed, summary.failed]);

  return (
    <div>
      {state.mock ? (
        <div className="mb-4">
          <Callout tone="caution" title="Mock data">
            This check ran in mock mode. The activity, sources, and findings are scripted
            sample data, not a live result.
          </Callout>
        </div>
      ) : null}

      {state.cachedAt !== null ? (
        <div className="mb-4">
          <Callout tone="info" title="Cached verification">
            These findings and the recorded browser run are a verified cache from{" "}
            {new Date(state.cachedAt).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            . Live pages may have changed; re-run before relying on a detail.
          </Callout>
        </div>
      ) : null}

      {stale ? (
        <div className="mb-4">
          <Callout tone="caution" title="Inputs changed since this check ran">
            <p>The result may not apply to the current trip.</p>
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
          summary={`${WORKER_IDS.length} live check · exact instructions`}
          open={preRunOpen}
          onToggle={() => setPreRunOpen((current) => !current)}
        >
          <div className="pt-4">
            <PreRun destination={destination} condition={condition} />
          </div>
        </Disclosure>
      ) : (
        <>
          <div className="mt-3">
            <FocusView
              worker={worker}
              state={state.workers[worker]}
              visible
              onRetry={() => onRetry(worker)}
            />
          </div>

          <div className="mt-3">
            <Disclosure
              title="Sources and findings"
              summary={`${MISSION_WORKERS[worker].name} · ${summary.findings}/${WORKER_IDS.length} complete`}
              open={evidenceOpen}
              onToggle={() => setEvidenceOpen((current) => !current)}
            >
              <div className={expanded ? "grid gap-x-10 lg:grid-cols-2" : undefined}>
                <SourcesList state={state} worker={worker} />
                <FindingsReveal state={state} worker={worker} dimmed={stale} />
              </div>
            </Disclosure>
          </div>
        </>
      )}
    </div>
  );
}
