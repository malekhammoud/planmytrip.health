/**
 * Designed pre-run state for the destination check.
 *
 * Inputs: none.
 * Outputs: one ruled row naming the advisory source, its host, and the facts it checks.
 * Invariants: no progress, counts, or instruction text appear before a run; the row names
 * only the real source and the calm summary of what it looks for.
 */

"use client";

import { MISSION_WORKERS, missionWorkers } from "@/components/mission/missionMeta";
import { StatusGlyph } from "@/components/ui";

/** One row that explains what the check will read. */
export function PreRun() {
  const worker = missionWorkers()[0];
  const meta = MISSION_WORKERS[worker];

  return (
    <div className="rounded-frame border border-solid border-hairline bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <StatusGlyph state="queued" label="Not checked yet" />
        <p className="t-heading text-ink">{meta.name}</p>
        <p className="t-data-sm text-muted">{meta.host}</p>
      </div>
      <p className="t-small measure mt-1 text-muted">{meta.checks}</p>
    </div>
  );
}
