/**
 * Streaming activity for the live workers.
 *
 * Inputs: the swarm state and the selected filter.
 * Outputs: the latest three real lines, an optional filter row, and one collapsed archive. New
 * lines type in when they arrive alone; older lines settle to muted after two seconds.
 * Invariants: heartbeats never appear; the feed is capped; the newest line is the only
 * one that types; the archive is a disclosure so the rail never grows into a report.
 */

"use client";

import { useEffect, useState } from "react";
import { Button, Disclosure } from "@/components/ui";
import { formatOffset, WORKER_TAG } from "@/components/mission/missionMeta";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { SwarmState } from "@/lib/swarmReducer";
import { mergedFeed, type FeedFilter, type FeedLine } from "@/lib/swarmTelemetry";
import { WORKER_IDS } from "@/lib/swarmTypes";

const FILTERS: readonly { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...WORKER_IDS.map((worker) => ({ id: worker, label: WORKER_TAG[worker] })),
];

const VISIBLE_LINES = 3;
const ARCHIVE_LINES = 50;

function FeedRow({
  line,
  newest,
  instant,
  origin,
}: {
  line: FeedLine;
  newest: boolean;
  instant: boolean;
  origin: number;
}) {
  const reduced = useReducedMotion();
  const [fresh, setFresh] = useState(true);
  const [revealed, setRevealed] = useState(() =>
    newest && !instant && !reduced ? 0 : line.text.length,
  );

  useEffect(() => {
    const timer = setTimeout(() => setFresh(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!newest || instant || reduced) return;
    const timer = setInterval(() => {
      setRevealed((value) => Math.min(value + 1, line.text.length));
    }, 25);
    return () => clearInterval(timer);
  }, [line.text.length, newest, instant, reduced]);

  const shown = !newest || instant || reduced ? line.text : line.text.slice(0, revealed);

  return (
    <li className="anim-rise grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-3 border-b border-solid border-hairline py-2 last:border-b-0">
      <span className="t-data-sm text-muted">{formatOffset(line.at, origin)}</span>
      <span className="t-label text-muted">{WORKER_TAG[line.worker]}</span>
      <span className={fresh ? "t-data text-ink" : "t-data text-muted"}>
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{line.text}</span>
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
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const feed = mergedFeed(state, filter);
  const [previousLength, setPreviousLength] = useState(feed.length);
  const delta = Math.max(0, feed.length - previousLength);
  const instant = delta >= VISIBLE_LINES;
  const origin = WORKER_IDS.reduce(
    (earliest, worker) => {
      const steps = state.workers[worker].steps;
      const first = steps[0]?.t;
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

  useEffect(() => {
    const commit = setTimeout(() => setPreviousLength(feed.length), 0);
    return () => clearTimeout(commit);
  }, [feed.length]);

  return (
    <div className="mt-6 border-y border-solid border-hairline">
      {WORKER_IDS.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 py-2">
          <p className="t-label mr-2 text-muted">Activity</p>
          {FILTERS.map((entry) => (
            <Button
              key={entry.id}
              variant={filter === entry.id ? "primary" : "secondary"}
              size="sm"
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div aria-live="off" aria-label="Agent activity" className="border-t border-solid border-hairline">
        {shown.length === 0 ? (
          <p className="t-small py-6 text-muted">No activity yet.</p>
        ) : (
          <ol>
            {shown.map((line) => (
              <FeedRow
                key={line.id}
                line={line}
                newest={line.id === newestId}
                instant={instant}
                origin={safeOrigin}
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
            <ol aria-label="Earlier agent activity">
              {archive.map((line) => (
                <FeedRow
                  key={line.id}
                  line={line}
                  newest={false}
                  instant
                  origin={safeOrigin}
                />
              ))}
            </ol>
          </Disclosure>
        </div>
      ) : null}
    </div>
  );
}
