"use client";

/**
 * Findings presentation for the completed destination check: typed DataRows, the source
 * host, and the retrieved time.
 *
 * Inputs: the single worker id and its completed state.
 * Outputs: four advisory rows, a source link labelled by host, and a retrieved timestamp.
 * Invariants: missing values read "Not found"; raw JSON and provider text never render;
 * rows arrive with a 60ms stagger unless reduced motion is active.
 */

import type { CSSProperties, ReactNode } from "react";
import { DataRow } from "@/components/ui";
import { NewMark } from "@/components/mission/NewMark";
import { formatRetrievedAt, hostOf } from "@/components/mission/missionMeta";
import type { WorkerState } from "@/lib/swarmReducer";
import { type AdvisoryFindings, type SwarmFindings, type WorkerId } from "@/lib/swarmTypes";

const NOT_FOUND = "Not found";

function textOrNotFound(value: string | null): string {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : NOT_FOUND;
}

function ListValue({ items }: { items: readonly string[] }) {
  const present = [...new Set(items.map((item) => item.trim()))].filter(
    (item) => item.length > 0,
  );
  if (present.length === 0) return <>{NOT_FOUND}</>;
  return (
    <ul className="flex flex-col gap-1">
      {present.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

interface FindingRow {
  label: string;
  value: ReactNode;
}

/** Turns typed findings into the four calm rows the destination check renders. */
function findingRows(worker: WorkerId, findings: SwarmFindings): readonly FindingRow[] {
  switch (worker) {
    case "advisory": {
      const data = findings as AdvisoryFindings;
      return [
        { label: "Risk level", value: textOrNotFound(data.destinationRiskLevel) },
        { label: "Risk summary", value: textOrNotFound(data.riskSummary) },
        { label: "Health notices", value: <ListValue items={data.healthNotices} /> },
        {
          label: "Environmental hazards",
          value: <ListValue items={data.environmentalHazards} />,
        },
      ];
    }
  }
}

/** Findings and provenance for the completed advisory check. */
export function WorkerFindings({
  worker,
  state,
  reveal = false,
}: {
  worker: WorkerId;
  state: WorkerState;
  /** Staggers each row with a 60ms arrival when the mission control reveals it. */
  reveal?: boolean;
}) {
  if (state.findings === null) return null;
  const sourceHost =
    state.sourceUrl === null || state.sourceUrl === ""
      ? NOT_FOUND
      : hostOf(state.sourceUrl, NOT_FOUND);

  return (
    <div>
      <dl>
        {findingRows(worker, state.findings).map((row, index) => {
          const style = reveal
            ? ({ animationDelay: `${index * 60}ms` } as CSSProperties)
            : undefined;
          return (
            <div
              key={row.label}
              className={reveal ? "anim-arrive" : undefined}
              style={style}
            >
              {reveal ? <NewMark /> : null}
              <DataRow label={row.label} layout="stacked">
                {row.value}
              </DataRow>
            </div>
          );
        })}
      </dl>
      {state.parseError !== null ? (
        <p className="t-small mt-3 text-muted">
          Some page details could not be read. Re-run the check for current results.
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-1">
        {state.sourceUrl === null || state.sourceUrl === "" ? (
          <p className="t-data text-muted">Source: {NOT_FOUND}</p>
        ) : (
          <a
            href={state.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center t-data text-accent [overflow-wrap:anywhere] hover:underline"
          >
            Source: {sourceHost}
          </a>
        )}
        <p className="t-data text-muted">
          Retrieved {formatRetrievedAt(state.retrievedAt)}
        </p>
      </div>
    </div>
  );
}
