/**
 * The compact status card for the destination check.
 *
 * Inputs: worker id, worker state, and a retry action.
 * Outputs: one calm card with the current phase, elapsed time, current page, source count,
 * an optional "Watch live" disclosure, and a neutral retry on failure.
 * Invariants: the live view stays one disclosure away and never dominates; no step count,
 * tempo strip, completion overlay, or provider copy is rendered; a failed check never
 * echoes upstream text.
 */

"use client";

import { useState } from "react";
import { Button, Disclosure, StatusGlyph } from "@/components/ui";
import { Elapsed } from "@/components/mission/Elapsed";
import {
  MISSION_WORKERS,
  PHASE_ACTIVITY,
  PHASE_GLYPH,
  checkTitle,
} from "@/components/mission/missionMeta";
import { swarmErrorCopy } from "@/lib/swarmErrors";
import type { WorkerState } from "@/lib/swarmReducer";
import { collectSources } from "@/lib/swarmTelemetry";
import type { WorkerId } from "@/lib/swarmTypes";

/** Props for {@link FocusView}. */
export interface FocusViewProps {
  worker: WorkerId;
  state: WorkerState;
  visible: boolean;
  onRetry: () => void;
}

/** One mounted status card; `visible` only controls whether it is shown. */
export function FocusView({ worker, state, visible, onRetry }: FocusViewProps) {
  const meta = MISSION_WORKERS[worker];
  const [watchOpen, setWatchOpen] = useState(false);
  const purpose = state.currentPurpose ?? PHASE_ACTIVITY[state.phase];
  const sourceCount = collectSources(state).length;
  const copy = swarmErrorCopy(state.errorCode);
  const live = state.phase === "queued" || state.phase === "running";

  return (
    <div
      className={[
        visible ? "block" : "hidden",
        "overflow-hidden rounded-frame border border-solid border-hairline-strong bg-surface",
      ].join(" ")}
      role="region"
      aria-label="Destination check status"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-solid border-hairline px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <StatusGlyph
            state={PHASE_GLYPH[state.phase]}
            label={checkTitle(state.phase, meta.host)}
          />
          <p className="t-data-sm text-muted">{meta.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {live ? (
            <Elapsed
              startedAt={state.startedAt}
              endedAt={state.endedAt}
              className="t-data text-muted"
            />
          ) : null}
          <p className="t-data-sm text-muted">
            {sourceCount} {sourceCount === 1 ? "source" : "sources"}
          </p>
        </div>
      </div>

      {state.phase === "error" ? (
        <div className="flex flex-col items-start gap-3 px-4 py-4">
          <div>
            <p className="t-heading text-ink">The destination check did not finish</p>
            <p className="t-small measure mt-1 text-muted">{copy.message}</p>
          </div>
          {copy.retryable ? (
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-3">
          <p className="t-label text-muted">Now</p>
          <p key={purpose} className="t-body anim-fade mt-1 text-ink">
            {purpose}
          </p>
        </div>
      )}

      {state.streamingUrl !== null ? (
        <div className="border-t border-solid border-hairline px-4 py-2">
          <Disclosure
            title="Watch live"
            summary="Live page"
            open={watchOpen}
            onToggle={() => setWatchOpen((current) => !current)}
          >
            <div className="mt-2 overflow-hidden rounded-frame border border-solid border-hairline bg-sunken">
              {watchOpen ? (
                <iframe
                  title={`${meta.name} live browser`}
                  src={state.streamingUrl}
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin"
                  className="aspect-[16/10] max-h-[360px] w-full border-0"
                />
              ) : null}
            </div>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}
