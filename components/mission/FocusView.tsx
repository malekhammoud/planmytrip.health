/**
 * The hero live view for one worker.
 *
 * Inputs: worker id, worker state, and a retry action.
 * Outputs: a 16:10 embedded TinyFish frame with a 32px chrome bar, the current purpose,
 * a tempo strip, completion choreography, or a calm error frame.
 * Invariants: all three focus views stay mounted so a hidden stream never reloads;
 * completion shows "Run complete" for one second and unmounts the iframe after 1.5s;
 * the static frame reports only the final purpose, steps, and duration.
 */

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, StatusGlyph } from "@/components/ui";
import { Elapsed } from "@/components/mission/Elapsed";
import {
  MISSION_WORKERS,
  PHASE_ACTIVITY,
  PHASE_GLYPH,
  PHASE_LABEL,
  formatDuration,
  hostOf,
} from "@/components/mission/missionMeta";
import { TempoStrip } from "@/components/mission/TempoStrip";
import { SWARM_RUN_LIMITS } from "@/lib/swarmConfig";
import type { WorkerState } from "@/lib/swarmReducer";
import { elapsedMs, tempoBuckets } from "@/lib/swarmTelemetry";
import { swarmErrorCopy } from "@/lib/swarmErrors";
import type { WorkerId } from "@/lib/swarmTypes";

/** Props for {@link FocusView}. */
export interface FocusViewProps {
  worker: WorkerId;
  state: WorkerState;
  visible: boolean;
  onRetry: () => void;
}

function subscribeFullscreen(callback: () => void): () => void {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}

function getFullscreen(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled === true;
}

/** Keeps the Expand action out of the server snapshot and off unsupported browsers. */
function useFullscreenSupported(): boolean {
  return useSyncExternalStore(subscribeFullscreen, getFullscreen, () => false);
}

// VERIFY: three distinct TinyFish preview streams can be embedded at once while the
// hidden ones stay mounted. A provider that limits concurrent viewers would need the
// hidden frames paused rather than left attached. Recheck on a real three-worker run.

/** One mounted live view; `visible` only controls which chrome is shown. */
export function FocusView({ worker, state, visible, onRetry }: FocusViewProps) {
  const meta = MISSION_WORKERS[worker];
  const frameRef = useRef<HTMLDivElement>(null);
  const canExpand = useFullscreenSupported();
  const [settledAt, setSettledAt] = useState<number | null>(null);
  const [runCompleteAt, setRunCompleteAt] = useState<number | null>(null);
  const purpose = state.currentPurpose ?? PHASE_ACTIVITY[state.phase];
  const buckets = tempoBuckets(state.steps);
  const showStream = state.phase !== "complete" || settledAt !== state.endedAt;
  const runComplete =
    state.phase === "complete" &&
    state.endedAt !== null &&
    runCompleteAt !== state.endedAt;
  const finalEnd = state.endedAt ?? state.lastEventAt ?? 0;

  useEffect(() => {
    if (state.phase !== "complete" || state.endedAt === null) return;
    const endedAt = state.endedAt;
    const settle = setTimeout(() => setRunCompleteAt(endedAt), 1000);
    const unmount = setTimeout(() => setSettledAt(endedAt), 1500);
    return () => {
      clearTimeout(settle);
      clearTimeout(unmount);
    };
  }, [state.phase, state.endedAt]);

  const expand = (): void => {
    const element = frameRef.current;
    if (element === null || typeof element.requestFullscreen !== "function") return;
    void element.requestFullscreen().catch(() => {
      // Fullscreen can be denied by policy; the inline frame remains usable.
    });
  };

  const host = hostOf(state.streamingUrl, meta.host);
  const live = state.phase === "running";

  return (
    <div
      ref={frameRef}
      className={[
        visible ? "block" : "hidden",
        "overflow-hidden rounded-frame border border-solid border-hairline-strong bg-surface",
      ].join(" ")}
      role="tabpanel"
      id={`mission-panel-${worker}`}
      aria-labelledby={`mission-tab-${worker}`}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-solid border-hairline px-3 py-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <StatusGlyph state={PHASE_GLYPH[state.phase]} label={PHASE_LABEL[state.phase]} />
          <p className="t-data truncate text-ink">{meta.name}</p>
          <p className="t-data-sm truncate text-muted">{host}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {live ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="anim-pulse-dot block h-2 w-2 bg-accent" />
              <span className="t-label text-ink">Live</span>
            </span>
          ) : null}
          <Elapsed
            startedAt={state.startedAt}
            endedAt={state.endedAt}
            className="t-data text-muted"
          />
          <p className="t-data-sm text-muted">
            step {state.stepCount} of {SWARM_RUN_LIMITS.maxSteps} max
          </p>
          {canExpand ? (
            <Button variant="ghost" size="sm" onClick={expand}>
              Expand
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative aspect-[16/10] max-h-[520px] w-full bg-sunken">
        {state.phase === "error" ? (
          <div className="flex h-full flex-col items-start justify-center gap-3 p-6">
            <p className="t-heading text-ink">This check did not finish</p>
            <p className="t-small measure text-risk">
              {swarmErrorCopy(state.errorCode).message}
            </p>
            {swarmErrorCopy(state.errorCode).retryable ? (
              <Button variant="secondary" onClick={onRetry}>
                Retry {meta.name.toLowerCase()}
              </Button>
            ) : null}
          </div>
        ) : showStream && state.streamingUrl !== null ? (
          <iframe
            title={`${meta.name} live browser`}
            src={state.streamingUrl}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0"
          />
        ) : state.phase === "complete" ? (
          <div className="flex h-full flex-col justify-center gap-2 p-6">
            <p className="t-label text-muted">Stream ended</p>
            <p className="t-heading text-ink">{purpose}</p>
            <p className="t-data text-muted">
              {state.stepCount} steps · {formatDuration(elapsedMs(state, finalEnd))} ·{" "}
              {PHASE_LABEL.complete}
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col justify-center gap-2 p-6">
            <p className="t-label text-muted">
              {state.phase === "idle" ? "Ready" : "Preparing"}
            </p>
            <p className="t-heading text-ink">
              {state.phase === "idle"
                ? "The live view appears when this check runs."
                : "Waiting for the browser preview."}
            </p>
            <p className="t-small measure text-muted">
              TinyFish returns a preview URL after the run starts. No frame is shown
              before that.
            </p>
          </div>
        )}

        {runComplete ? (
          <div className="absolute inset-0 flex items-center justify-center bg-paper">
            <p className="t-title anim-fade text-ink">Run complete</p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-solid border-hairline px-3 py-3">
        <p key={purpose} className="t-heading anim-fade text-ink">
          {purpose}
        </p>
        <div className="mt-2">
          <TempoStrip
            buckets={buckets}
            height={48}
            ticks
            label={`${meta.name} tempo, ${state.stepCount} steps`}
          />
        </div>
      </div>
    </div>
  );
}
