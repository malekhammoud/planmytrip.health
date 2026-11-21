/**
 * One worker tile in the mission tablist.
 *
 * Inputs: worker id, worker state, selected flag, select and retry actions.
 * Outputs: status, name, newest line, step count, elapsed time, a 24px tempo strip,
 * and a connection dot.
 * Invariants: the tile is a tab, never a card; selection is a 2px ink top rule; no
 * thumbnail of the stream is rendered here.
 */

"use client";

import { StatusGlyph } from "@/components/ui";
import { ConnectionStatus } from "@/components/mission/ConnectionStatus";
import { Elapsed } from "@/components/mission/Elapsed";
import {
  MISSION_WORKERS,
  PHASE_ACTIVITY,
  PHASE_GLYPH,
  PHASE_LABEL,
} from "@/components/mission/missionMeta";
import { TempoStrip } from "@/components/mission/TempoStrip";
import type { WorkerState } from "@/lib/swarmReducer";
import { swarmErrorCopy } from "@/lib/swarmErrors";
import { tempoBuckets } from "@/lib/swarmTelemetry";
import type { WorkerId } from "@/lib/swarmTypes";

/** Props for {@link WorkerTile}. */
export interface WorkerTileProps {
  worker: WorkerId;
  state: WorkerState;
  selected: boolean;
  onSelect: () => void;
}

/** A tab that reports only real state. */
export function WorkerTile({ worker, state, selected, onSelect }: WorkerTileProps) {
  const meta = MISSION_WORKERS[worker];
  const purpose = state.currentPurpose ?? PHASE_ACTIVITY[state.phase];

  return (
    <div
      role="tab"
      id={`mission-tab-${worker}`}
      aria-selected={selected}
      aria-controls={`mission-panel-${worker}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={[
        "min-w-0 cursor-pointer border-solid bg-paper px-4 py-4 outline-offset-2",
        selected ? "border-t-2 border-ink" : "border-t border-hairline hover:bg-sunken",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusGlyph state={PHASE_GLYPH[state.phase]} label={PHASE_LABEL[state.phase]} />
        <ConnectionStatus state={state} />
      </div>
      <p className="t-heading mt-2 truncate text-ink">{meta.name}</p>
      <p className="t-data-sm mt-1 truncate text-muted">{purpose}</p>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="t-data-sm text-muted">{state.stepCount} steps</p>
        <Elapsed
          startedAt={state.startedAt}
          endedAt={state.endedAt}
          className="t-data-sm text-muted"
        />
      </div>
      <div className="mt-2">
        <TempoStrip
          buckets={tempoBuckets(state.steps)}
          height={24}
          label={`${meta.name} mini tempo, ${state.stepCount} steps`}
        />
      </div>
      {state.phase === "error" ? (
        <p className="t-small mt-3 measure text-risk">
          {swarmErrorCopy(state.errorCode).message}
        </p>
      ) : null}
    </div>
  );
}
