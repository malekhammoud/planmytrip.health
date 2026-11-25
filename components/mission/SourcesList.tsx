/**
 * Source ledger for the destination check.
 *
 * Inputs: the swarm state.
 * Outputs: deduplicated rows with the page host and title, or the title alone when the
 * provider exposed no URL.
 * Invariants: only rows backed by a real source event appear; worker and API tags never
 * render; the list is capped by the telemetry contract.
 */

"use client";

import { hostOf } from "@/components/mission/missionMeta";
import type { SwarmState } from "@/lib/swarmReducer";
import { collectSources } from "@/lib/swarmTelemetry";
import { WORKER_IDS } from "@/lib/swarmTypes";

/** Props for {@link SourcesList}. */
export interface SourcesListProps {
  state: SwarmState;
}

/** The growing provenance list, with no placeholder rows. */
export function SourcesList({ state }: SourcesListProps) {
  const items = collectSources(state.workers[WORKER_IDS[0]]);

  if (items.length === 0) {
    return <p className="t-small py-4 text-muted">No sources consulted yet.</p>;
  }

  return (
    <ul>
      {items.map((item) => {
        const host = item.url === undefined ? null : hostOf(item.url);
        const title = item.title ?? host ?? "Untitled source";
        return (
          <li
            key={item.url ?? `title:${item.title ?? ""}`}
            className="anim-arrive grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-solid border-hairline py-2 last:border-b-0"
          >
            {item.url === undefined ? (
              <p className="t-data min-w-0 text-ink">{title}</p>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="t-data min-w-0 text-accent hover:underline [overflow-wrap:anywhere]"
              >
                {title}
              </a>
            )}
            {host === null ? null : <p className="t-data-sm text-muted">{host}</p>}
          </li>
        );
      })}
    </ul>
  );
}
