/**
 * Live source ledger for the three workers.
 *
 * Inputs: the swarm state.
 * Outputs: deduplicated source rows with host, title, worker, API tag, and a safe link.
 * Invariants: only rows backed by TF_API_RESULT or a search/fetch step appear; new rows
 * get an arrival wash, or a static New label under reduced motion; the list is capped.
 */

"use client";

import { hostOf, WORKER_TAG } from "@/components/mission/missionMeta";
import { NewMark } from "@/components/mission/NewMark";
import type { SwarmState } from "@/lib/swarmReducer";
import { collectSources } from "@/lib/swarmTelemetry";
import { WORKER_IDS, type SwarmSourceItem, type WorkerId } from "@/lib/swarmTypes";

interface SourceRow {
  worker: WorkerId;
  item: SwarmSourceItem;
  key: string;
}

const API_LABEL = { search: "search", fetch: "fetch" } as const;

function rows(state: SwarmState, focus?: WorkerId): SourceRow[] {
  const output: SourceRow[] = [];
  for (const worker of focus === undefined ? WORKER_IDS : [focus]) {
    for (const item of collectSources(state.workers[worker])) {
      output.push({
        worker,
        item,
        key: `${worker}-${item.url ?? item.title ?? ""}`,
      });
      if (output.length >= 100) return output;
    }
  }
  return output;
}

/** Props for {@link SourcesList}. */
export interface SourcesListProps {
  state: SwarmState;
  /** When set, only this worker's sources appear; the tiles choose it. */
  worker?: WorkerId;
}

/** The growing provenance list, with no placeholder rows. */
export function SourcesList({ state, worker }: SourcesListProps) {
  const items = rows(state, worker);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-solid border-hairline pb-2">
        <p className="t-label text-muted">
          Sources{worker === undefined ? " consulted" : ` · ${WORKER_TAG[worker]}`}
        </p>
        <p className="t-data-sm text-muted">{items.length}</p>
      </div>
      {items.length === 0 ? (
        <p className="t-small py-4 text-muted">
          {worker === undefined
            ? "No sources consulted yet."
            : `No sources yet for ${WORKER_TAG[worker]}.`}
        </p>
      ) : (
        <ul>
          {items.map(({ worker, item, key }) => (
            <li
              key={key}
              className="anim-arrive grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-solid border-hairline py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="t-data truncate text-ink">{hostOf(item.url, "No URL")}</p>
                  <span className="t-label text-muted">{WORKER_TAG[worker]}</span>
                  <span className="t-label text-accent">{API_LABEL[item.api]}</span>
                  <NewMark />
                </div>
                {item.url === undefined ? (
                  <p className="t-small text-muted">{item.title}</p>
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="t-small text-accent hover:underline [overflow-wrap:anywhere]"
                  >
                    {item.title ?? item.url}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
