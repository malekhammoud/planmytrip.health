/**
 * One venue tab in the page-check deck.
 *
 * Inputs: worker state, its ordinal, selected flag, and select action.
 * Outputs: category, venue name, newest purpose, the checked result, actions, and sources.
 * Invariants: only accepted telemetry is shown; selection is a 2px ink top rule; no
 * thumbnail or invented activity appears here.
 */

"use client";

import { StatusGlyph, type StatusGlyphState } from "@/components/ui";
import { formatMoney, hostOfUrl } from "@/lib/venue/format";
import type { VenueWorkerState } from "@/lib/venue/venueState";

const PHASE_LABEL: Record<VenueWorkerState["phase"], string> = {
  queued: "Preparing",
  running: "Reading",
  complete: "Checked",
  error: "Needs retry",
};

const PHASE_GLYPH: Record<VenueWorkerState["phase"], StatusGlyphState> = {
  queued: "queued",
  running: "running",
  complete: "done",
  error: "error",
};

function resultLine(worker: VenueWorkerState): string {
  if (worker.evidence?.kind === "hotel") {
    return worker.evidence.nightlyRate === null
      ? "Rate checked"
      : `${formatMoney(worker.evidence.nightlyRate, worker.evidence.currency)} / night`;
  }
  if (worker.evidence?.kind === "menu") {
    return `${worker.evidence.items.length} ${worker.evidence.items.length === 1 ? "item" : "items"}`;
  }
  if (worker.phase === "error") return "Page not checked";
  return "Pending";
}

/** One selectable venue tile. */
export function VenueWorkerTile({
  worker,
  ordinal,
  selected,
  onSelect,
}: {
  worker: VenueWorkerState;
  ordinal: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = worker.meta.kind === "hotel" ? "Hotel rate" : "Menu";
  return (
    <div
      role="tab"
      id={`venue-tab-${worker.meta.id}`}
      aria-selected={selected}
      aria-controls={`venue-panel-${worker.meta.id}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={[
        "min-w-0 cursor-pointer border-solid px-3 py-3 outline-offset-2",
        selected
          ? "border-t-2 border-ink bg-accent-soft"
          : "border-t border-hairline bg-paper hover:bg-sunken",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusGlyph state={PHASE_GLYPH[worker.phase]} label={PHASE_LABEL[worker.phase]} />
        <span className="t-data-sm text-muted">
          {String(ordinal).padStart(2, "0")}
          {worker.cached ? " · cached" : ""}
        </span>
      </div>
      <p className="t-heading mt-2 line-clamp-2 min-h-12 text-ink">{worker.meta.name}</p>
      <p className="t-data-sm mt-1 truncate text-muted">
        {kind} ·{" "}
        {hostOfUrl(worker.evidence?.sourceUrl ?? worker.meta.sourceUrl, "page not stated")}
      </p>
      <p className="t-small mt-2 line-clamp-2 min-h-10 text-ink">
        {worker.currentPurpose ?? "Waiting for the page."}
      </p>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-solid border-hairline pt-2">
        <p className="t-data-sm text-ink">{resultLine(worker)}</p>
        <p className="t-data-sm text-muted">
          {worker.steps} {worker.steps === 1 ? "action" : "actions"} ·{" "}
          {worker.sources.length} {worker.sources.length === 1 ? "source" : "sources"}
        </p>
      </div>
    </div>
  );
}
