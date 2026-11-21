"use client";

/**
 * Findings presentation for one completed worker: DataRow lists, source provenance,
 * retrieved time, and the raw JSON block with a clipboard copy action.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button, DataRow } from "@/components/ui";
import { NewMark } from "@/components/mission/NewMark";
import type { WorkerState } from "@/lib/swarmReducer";
import {
  type AdvisoryFindings,
  type CoverageChecklistItem,
  type CoverageFindings,
  type PharmacyFindings,
  type SwarmFindings,
  type WorkerId,
} from "@/lib/swarmTypes";

const NOT_FOUND = "Not found";

function textOrNotFound(value: string | null): string {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : NOT_FOUND;
}

/** Formats the retrieved ISO timestamp in UTC, without locale-dependent output. */
function formatRetrievedAt(value: string | null): string {
  if (value === null || value === "") return NOT_FOUND;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return NOT_FOUND;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function ListValue({ items }: { items: readonly string[] }) {
  if (items.length === 0) return <>{NOT_FOUND}</>;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ChecklistValue({ items }: { items: readonly CoverageChecklistItem[] }) {
  if (items.length === 0) return <>{NOT_FOUND}</>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((entry, index) => (
        <li
          key={`${index}-${entry.source}-${entry.item}`}
          className="flex flex-wrap items-baseline gap-2"
        >
          <span className="t-label text-muted">{entry.source}</span>
          <span>{entry.item}</span>
        </li>
      ))}
    </ul>
  );
}

interface FindingRow {
  label: string;
  value: ReactNode;
}

/** Turns typed findings into the rows the design contract names for each worker. */
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
    case "pharmacy": {
      const data = findings as PharmacyFindings;
      return [
        { label: "Generic name", value: textOrNotFound(data.genericName) },
        { label: "Local brand names", value: <ListValue items={data.localBrandNames} /> },
        { label: "Customs rules", value: textOrNotFound(data.customsRules) },
        { label: "Carry rules", value: textOrNotFound(data.carryRules) },
      ];
    }
    case "coverage": {
      const data = findings as CoverageFindings;
      return [
        { label: "Emergency medical limit", value: textOrNotFound(data.emergencyMedicalLimit) },
        { label: "Pre-authorization rules", value: textOrNotFound(data.preAuthorizationRules) },
        { label: "Checklist", value: <ChecklistValue items={data.checklist} /> },
      ];
    }
  }
}

/** Ghost toggle over a sunken mono block with a two-second Copied state. */
function RawJson({ text, parseError }: { text: string; parseError: string | null }) {
  // A parse error is a safety signal: show the raw text immediately, but keep it
  // collapsible. The agent's own parse-error copy says the raw result is shown.
  const [open, setOpen] = useState(parseError !== null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const body = parseError === null ? text : `Parse error: ${parseError}\n\n${text}`;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy(): Promise<void> {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  function toggleOpen(): void {
    setOpen((value) => !value);
    setCopyFailed(false);
  }

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {open ? "Hide raw JSON" : "View raw JSON"}
      </Button>
      {open ? (
        <div className="mt-2 overflow-hidden rounded-frame border border-hairline bg-sunken">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2">
            <p className="t-label text-muted">Raw result</p>
            <Button variant="secondary" onClick={() => void handleCopy()}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre
            tabIndex={0}
            aria-label="Raw result"
            className="max-h-64 overflow-auto p-3 t-data-sm text-ink whitespace-pre-wrap [overflow-wrap:anywhere]"
          >
            {body}
          </pre>
          {copyFailed ? (
            <p role="status" className="border-t border-hairline px-3 py-2 t-small text-muted">
              Copy failed. Select the raw text above.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Findings, provenance, and the raw JSON toggle for one completed worker. */
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
  const rawText =
    state.rawResult ??
    JSON.stringify(
      {
        findings: state.findings,
        sourceUrl: state.sourceUrl,
        retrievedAt: state.retrievedAt,
      },
      null,
      2,
    );
  return (
    <div className="mt-4">
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
            Source: {state.sourceUrl}
          </a>
        )}
        <p className="t-data text-muted">
          Retrieved {formatRetrievedAt(state.retrievedAt)}
        </p>
      </div>
      <RawJson text={rawText} parseError={state.parseError} />
    </div>
  );
}
