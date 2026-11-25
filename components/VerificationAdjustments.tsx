/**
 * Verification adjustment switches.
 *
 * Inputs: typed adjustments, the master switch, disabled ids, and change handlers.
 * Outputs: a master Checkbox, one toggle per adjustment, a diff line, and provenance.
 * Invariants: switching off restores exactly the engine plan; the list never invents an
 * adjustment; every applied row keeps its source URL and retrieved time.
 */

"use client";

import { Checkbox } from "@/components/ui";
import { formatRetrievedAt, hostOf, WORKER_TAG } from "@/components/mission/missionMeta";
import type { VerificationAdjustment } from "@/lib/verificationOverlay";

/** Props for {@link AdjustmentsPanel}. */
export interface AdjustmentsPanelProps {
  adjustments: readonly VerificationAdjustment[];
  master: boolean;
  onMaster: (enabled: boolean) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

function detail(adjustment: VerificationAdjustment): string {
  const reason = adjustment.reason.trim().replace(/[.!?]+$/, "");
  if (adjustment.kind === "recovery") {
    return `Afternoon recovery ${adjustment.fromValue ?? 0} to ${adjustment.toValue ?? 0} min. ${reason}.`;
  }
  return `Day checkpoints. ${reason}.`;
}

/** Adjustment list rendered under the safety SectionHeader. */
export function AdjustmentsPanel({
  adjustments,
  master,
  onMaster,
  onToggle,
}: AdjustmentsPanelProps) {
  if (adjustments.length === 0) {
    return (
      <p className="mt-4 t-small text-muted">
        No live adjustments match this verification.
      </p>
    );
  }
  const applied = adjustments.filter((adjustment) => adjustment.applied).length;

  return (
    <div className="mt-4 border-t border-solid border-hairline pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="t-label text-muted">Live adjustments</p>
        <p aria-live="polite" className="t-data-sm text-muted">
          {applied} of {adjustments.length} applied
        </p>
      </div>
      <p className="t-small measure mt-1 text-muted">
        Verification can only tighten the engine plan. Turning an adjustment off restores
        the engine value.
      </p>
      <div className="mt-2">
        <Checkbox
          id="apply-live-adjustments"
          label="Apply live adjustments"
          checked={master}
          onChange={onMaster}
        />
      </div>
      <ul className="mt-2 grid gap-x-10 md:grid-cols-2">
        {adjustments.map((adjustment) => {
          const id = `adjustment-${adjustment.id.replace(/[^a-zA-Z0-9-]/g, "-")}`;
          return (
            <li
              key={adjustment.id}
              className="border-t border-solid border-hairline py-3"
            >
              <Checkbox
                id={id}
                label={`${adjustment.title}${
                  adjustment.dayIndex === undefined
                    ? ""
                    : ` · Day ${adjustment.dayIndex + 1}`
                }`}
                checked={adjustment.applied}
                disabled={!master}
                onChange={(enabled) => onToggle(adjustment.id, enabled)}
              />
              <p className="t-small measure text-ink">{detail(adjustment)}</p>
              <p className="t-small mt-1 text-muted">
                {WORKER_TAG[adjustment.sourceWorker]} ·{" "}
                {adjustment.sourceUrl === "" ? (
                  "Source not recorded"
                ) : (
                  <a
                    href={adjustment.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline [overflow-wrap:anywhere]"
                  >
                    {hostOf(adjustment.sourceUrl)}
                  </a>
                )}{" "}
                · Retrieved {formatRetrievedAt(adjustment.retrievedAt)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
