/**
 * Chronological activity feed for the three workers.
 *
 * Inputs: the swarm state and the selected filter.
 * Outputs: a 320px scrolling list of real progress and retry lines, with worker tags,
 * relative times, a filter row, and a jump-to-latest control.
 * Invariants: heartbeats never appear; the feed is capped; the newest line types only
 * when it arrived alone; older lines settle to muted after two seconds; the region is
 * aria-live off and state changes are announced by the status bar instead.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { formatOffset, WORKER_TAG } from "@/components/mission/missionMeta";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { SwarmState } from "@/lib/swarmReducer";
import {
  mergedFeed,
  type FeedFilter,
  type FeedLine,
} from "@/lib/swarmTelemetry";
import { WORKER_IDS } from "@/lib/swarmTypes";

const FILTERS: readonly { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...WORKER_IDS.map((worker) => ({ id: worker, label: WORKER_TAG[worker] })),
];

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

/** Real activity only: no heartbeats, no synthetic rows. */
export function ActivityFeed({ state }: ActivityFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const feed = mergedFeed(state, filter);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const programmaticRef = useRef(false);
  const [previousLength, setPreviousLength] = useState(feed.length);
  const [jump, setJump] = useState(0);
  const delta = Math.max(0, feed.length - previousLength);
  const instant = delta >= 3;
  const origin = WORKER_IDS.reduce((earliest, worker) => {
    const steps = state.workers[worker].steps;
    const first = steps[0]?.t;
    if (first === undefined) return earliest;
    return Math.min(earliest, first);
  }, feed[0]?.at ?? Number.POSITIVE_INFINITY);
  const safeOrigin = Number.isFinite(origin) ? origin : 0;
  const newestId = feed[feed.length - 1]?.id;

  const scrollToLatest = (): void => {
    const element = scrollRef.current;
    if (element === null) return;
    programmaticRef.current = true;
    element.scrollTop = element.scrollHeight;
    requestAnimationFrame(() => {
      programmaticRef.current = false;
    });
  };

  useEffect(() => {
    const commit = setTimeout(() => setPreviousLength(feed.length), 0);
    const frame = requestAnimationFrame(() => {
      if (stickRef.current) scrollToLatest();
    });
    if (delta > 0 && !stickRef.current) {
      const count = setTimeout(() => setJump((value) => value + delta), 0);
      return () => {
        clearTimeout(commit);
        clearTimeout(count);
        cancelAnimationFrame(frame);
      };
    }
    return () => {
      clearTimeout(commit);
      cancelAnimationFrame(frame);
    };
  }, [feed.length, delta]);

  useEffect(() => {
    const reset = setTimeout(() => {
      stickRef.current = true;
      setJump(0);
    }, 0);
    const frame = requestAnimationFrame(scrollToLatest);
    return () => {
      clearTimeout(reset);
      cancelAnimationFrame(frame);
    };
  }, [filter]);

  const onScroll = (): void => {
    if (programmaticRef.current) return;
    const element = scrollRef.current;
    if (element === null) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    stickRef.current = distance < 24;
    if (stickRef.current) setJump(0);
  };

  const jumpToLatest = (): void => {
    stickRef.current = true;
    setJump(0);
    scrollToLatest();
  };

  return (
    <div className="mt-6 border-y border-solid border-hairline">
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
      <div
        ref={scrollRef}
        onScroll={onScroll}
        aria-live="off"
        aria-label="Agent activity"
        className="h-80 overflow-y-auto border-t border-solid border-hairline"
      >
        {feed.length === 0 ? (
          <p className="t-small py-6 text-muted">No activity yet.</p>
        ) : (
          <ol>
            {feed.map((line) => (
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
      {jump > 0 ? (
        <div className="border-t border-solid border-hairline py-1">
          <Button variant="ghost" size="sm" onClick={jumpToLatest}>
            Jump to latest ({jump})
          </Button>
        </div>
      ) : null}
    </div>
  );
}
