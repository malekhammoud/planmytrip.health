/**
 * The hero live browser for one venue page.
 *
 * Inputs: one venue worker state, the run start, and a visible flag.
 * Outputs: a live iframe while TinyFish is running, the checked facts where the frame
 * ends, or a calm preparing/error frame; a per-page clock and a real fullscreen action.
 * Invariants: all venue frames stay mounted and hidden rather than reloaded; the iframe is
 * used only while a queued or running worker has an allowlisted streaming URL; a completed
 * page is never replayed as a live view; the clock never ticks on a settled page.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Maximize2, Minimize2 } from "lucide-react";
import { Button, StatusGlyph, type StatusGlyphState } from "@/components/ui";
import { VenueEvidencePreview } from "@/components/venue/VenueEvidencePreview";
import { useNow } from "@/hooks/useNow";
import {
  checkedDate,
  checkedStamp,
  displayOffset,
  formatClock,
  hostOfUrl,
} from "@/lib/venue/format";
import type { VenueWorkerState } from "@/lib/venue/venueState";

const PHASE_LABEL: Record<VenueWorkerState["phase"], string> = {
  queued: "Preparing",
  running: "Reading live",
  complete: "Page checked",
  error: "Needs retry",
};

const PHASE_GLYPH: Record<VenueWorkerState["phase"], StatusGlyphState> = {
  queued: "queued",
  running: "running",
  complete: "done",
  error: "error",
};

function PageClock({ worker }: { worker: VenueWorkerState }) {
  const live = worker.phase === "running";
  const now = useNow(live);
  if (worker.startedAt === null) return null;
  const start = Date.parse(worker.startedAt);
  const end =
    worker.endedAt !== null
      ? Date.parse(worker.endedAt)
      : live && now > 0
        ? now
        : start;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return <span className="t-data-sm text-muted">{formatClock((end - start) / 1000)}</span>;
}

/** One mounted venue browser. */
export function VenueLiveView({
  worker,
  runStartedAt,
  visible,
  onRetry,
}: {
  worker: VenueWorkerState;
  runStartedAt: string | null;
  visible: boolean;
  onRetry: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const host = hostOfUrl(
    worker.streamingUrl ?? worker.evidence?.sourceUrl ?? worker.meta.sourceUrl,
    "venue page",
  );
  const frame = worker.streamingUrl;
  const showFrame =
    (worker.phase === "queued" || worker.phase === "running") && frame !== null;
  const live = worker.phase === "running" && frame !== null;
  const lastLine = worker.activity.at(-1) ?? null;
  const offset =
    lastLine === null
      ? null
      : displayOffset(runStartedAt, lastLine.ts, lastLine.offsetSec);

  useEffect(() => {
    const onChange = (): void => {
      setExpanded(document.fullscreenElement === panelRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleExpand = (): void => {
    if (document.fullscreenElement === panelRef.current) {
      void document.exitFullscreen?.().catch(() => {});
      return;
    }
    const request = panelRef.current?.requestFullscreen;
    if (request === undefined || panelRef.current === null) return;
    void request.call(panelRef.current).catch(() => {});
  };

  return (
    <div
      ref={panelRef}
      className={[
        visible ? "block" : "hidden",
        "overflow-hidden rounded-frame border border-solid border-hairline-strong bg-surface",
      ].join(" ")}
      role="tabpanel"
      id={`venue-panel-${worker.meta.id}`}
      aria-labelledby={`venue-tab-${worker.meta.id}`}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-solid border-hairline px-3 py-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <StatusGlyph state={PHASE_GLYPH[worker.phase]} label={PHASE_LABEL[worker.phase]} />
          <p className="t-data truncate text-ink">{worker.meta.name}</p>
          <p className="t-data-sm truncate text-muted">{host}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {live ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="anim-pulse-dot block h-2 w-2 bg-accent" />
              <span className="t-label text-ink">Live</span>
            </span>
          ) : null}
          {worker.cached ? (
            <span className="t-data-sm text-muted">
              Cached{worker.evidence === null ? "" : ` · ${checkedDate(worker.evidence.retrievedAt)}`}
            </span>
          ) : null}
          <PageClock worker={worker} />
          <p className="t-data-sm text-muted">
            {worker.steps} {worker.steps === 1 ? "action" : "actions"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleExpand}
            leadingIcon={expanded ? Minimize2 : Maximize2}
          >
            {expanded ? "Close" : "Expand"}
          </Button>
        </div>
      </div>

      <div
        className={
          expanded
            ? "relative h-[calc(100vh-96px)] w-full bg-paper"
            : "relative aspect-[16/10] max-h-[560px] w-full bg-paper"
        }
      >
        {worker.phase === "error" ? (
          <div className="flex h-full flex-col items-start justify-center gap-3 p-6">
            <p className="t-heading text-ink">This venue page could not be checked</p>
            <p className="t-small measure text-risk">
              {worker.error ?? "The browser run stopped before it returned a result."}
            </p>
            <Button variant="secondary" onClick={onRetry}>
              Retry venue research
            </Button>
          </div>
        ) : showFrame ? (
          <iframe
            title={`${worker.meta.name} live browser`}
            src={frame}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0"
          />
        ) : worker.phase === "complete" && worker.evidence !== null ? (
          <div className="absolute inset-0">
            <VenueEvidencePreview evidence={worker.evidence} />
          </div>
        ) : worker.phase === "complete" ? (
          <div className="flex h-full flex-col justify-center gap-3 p-6">
            <p className="t-label text-muted">Checked page</p>
            <p className="t-heading text-ink">{worker.meta.name}</p>
            <p className="t-small measure text-muted">
              The browser finished the page, but no structured facts were returned.
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col justify-between gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="t-label text-muted">
                {worker.phase === "queued" ? "Browser queued" : "Browser opening"}
              </p>
              <p className="t-data-sm text-muted">{host}</p>
            </div>
            <div className="flex max-w-[52ch] flex-col gap-3">
              <Globe size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
              <p className="t-heading text-ink">
                {worker.phase === "queued"
                  ? "Preparing the browser check"
                  : "Opening the venue page"}
              </p>
              <p className="t-small text-muted">
                TinyFish returns the live page view when this browser starts. The frame is
                shown only after the provider sends its preview URL.
              </p>
            </div>
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="block h-1 flex-1 bg-hairline" />
              <span className="block h-1 flex-1 bg-hairline" />
              <span className="block h-1 flex-1 bg-hairline" />
              <span className="block h-1 flex-1 bg-hairline" />
              <span className="block h-1 flex-1 bg-hairline" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-solid border-hairline px-3 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p
            key={worker.currentPurpose ?? worker.phase}
            className="t-heading anim-fade text-ink"
          >
            {worker.currentPurpose ?? "Waiting for the first page action."}
          </p>
          <p className="t-data-sm text-muted">
            {offset === null ? "" : `${offset} · `}
            {PHASE_LABEL[worker.phase]}
          </p>
        </div>
        {worker.phase === "complete" && worker.evidence !== null ? (
          <p className="t-data-sm mt-1 text-muted">
            Checked {checkedStamp(worker.evidence.retrievedAt)} ·{" "}
            {worker.sources.length} {worker.sources.length === 1 ? "source" : "sources"} ·{" "}
            {worker.evidence.kind === "hotel" ? "room rate" : "menu"} facts extracted
          </p>
        ) : null}
      </div>
    </div>
  );
}
