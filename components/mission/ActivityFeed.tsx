/**
 * Streaming activity for the destination check.
 *
 * Inputs: the swarm state.
 * Outputs: the latest three real lines and one collapsed archive, each showing an offset
 * and the page action.
 * Invariants: heartbeats, worker tags, and filters never appear; the feed is capped; the
 * archive is a disclosure so the rail never grows into a report.
 */

"use client";

import { useState } from "react";
import { Disclosure } from "@/components/ui";
import { formatOffset } from "@/components/mission/missionMeta";
import type { SwarmState } from "@/lib/swarmReducer";
import { mergedFeed, type FeedLine } from "@/lib/swarmTelemetry";
import { WORKER_IDS } from "@/lib/swarmTypes";

const VISIBLE_LINES = 3;
const ARCHIVE_LINES = 50;

function FeedRow({
  line,
  newest,
  origin,
  animate,
}: {
  line: FeedLine;
  newest: boolean;
  origin: number;
  animate: boolean;
}) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 border-b border-solid border-hairline py-2 last:border-b-0">
      <span className="t-data-sm text-muted">{formatOffset(line.at, origin)}</span>
      <span className={newest && animate ? "t-data anim-fade text-ink" : "t-data text-ink"}>
        {line.text}
      </span>
    </li>
  );
}

/** Props for {@link ActivityFeed}. */
export interface ActivityFeedProps {
  state: SwarmState;
}

/** Real activity only: no heartbeats, no synthetic rows, no growing report. */
export function ActivityFeed({ state }: ActivityFeedProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const feed = mergedFeed(state);
  const origin = WORKER_IDS.reduce(
    (earliest, worker) => {
      const first = state.workers[worker].steps[0]?.t;
      if (first === undefined) return earliest;
      return Math.min(earliest, first);
    },
    feed[0]?.at ?? Number.POSITIVE_INFINITY,
  );
  const safeOrigin = Number.isFinite(origin) ? origin : 0;
  const shown = feed.slice(-VISIBLE_LINES);
  const older = feed.slice(0, -VISIBLE_LINES);
  const archive = older.slice(-ARCHIVE_LINES).reverse();
  const newestId = shown[shown.length - 1]?.id;

  return (
    <div className="mt-6 border-y border-solid border-hairline">
      <div
        aria-live="off"
        aria-label="Destination check activity"
        className="border-t border-solid border-hairline"
      >
        {shown.length === 0 ? (
          <p className="t-small py-6 text-muted">
            Page reads appear here when the check starts.
          </p>
        ) : (
          <ol>
            {shown.map((line) => (
              <FeedRow
                key={line.id}
                line={line}
                newest={line.id === newestId}
                origin={safeOrigin}
                animate
              />
            ))}
          </ol>
        )}
      </div>
      {archive.length > 0 ? (
        <div className="border-t border-solid border-hairline">
          <Disclosure
            title="Earlier activity"
            summary={`${older.length} earlier`}
            open={archiveOpen}
            onToggle={() => setArchiveOpen((current) => !current)}
          >
            <ol aria-label="Earlier destination check activity">
              {archive.map((line) => (
                <FeedRow
                  key={line.id}
                  line={line}
                  newest={false}
                  origin={safeOrigin}
                  animate={false}
                />
              ))}
            </ol>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}
