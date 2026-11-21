"use client";

/**
 * Live or preparing frame for one swarm worker.
 *
 * Inputs: the worker name for the iframe title and the allowlisted streaming URL, or
 * null before one arrives. Outputs: one 16:10 frame whose 28px bar is identical in both
 * states, so the column does not jump when the preview starts.
 * Invariants: the bar host is derived from the accepted URL; it is hidden below 1280px
 * where the three columns are too narrow; the skeleton never shows LIVE.
 */

import { Circle } from "lucide-react";
import { Skeleton } from "@/components/ui";

/** Props for {@link WorkerLivePanel}. */
export interface WorkerLivePanelProps {
  /** Worker name, used only in the iframe title. */
  workerName: string;
  /** Allowlisted https preview URL, or null while the agent prepares. */
  url: string | null;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** One live preview frame, or its matching-height preparing skeleton. */
export function WorkerLivePanel({ workerName, url }: WorkerLivePanelProps) {
  if (url === null) {
    return (
      <div className="mt-4 overflow-hidden rounded-frame border border-hairline-strong bg-surface">
        <div className="flex h-7 items-center gap-2 border-b border-hairline px-3">
          <span aria-hidden="true" className="flex h-2 w-2 items-center justify-center">
            <Circle size={8} strokeWidth={0} className="fill-muted" />
          </span>
          <span className="t-label text-muted">PREPARING</span>
        </div>
        <div className="aspect-[16/10]">
          <Skeleton width="100%" height="100%" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-frame border border-hairline-strong bg-surface">
      <div className="flex h-7 items-center gap-2 border-b border-hairline px-3">
        <span
          aria-hidden="true"
          className="status-pulse flex h-2 w-2 items-center justify-center"
        >
          <Circle size={8} strokeWidth={0} className="fill-accent" />
        </span>
        <span className="t-label text-ink">LIVE</span>
        <span className="t-data ml-auto hidden text-muted xl:block">
          {hostFromUrl(url)}
        </span>
      </div>
      <iframe
        title={`Live ${workerName} agent session`}
        src={url}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
        className="block aspect-[16/10] w-full border-0 bg-surface"
      />
    </div>
  );
}
