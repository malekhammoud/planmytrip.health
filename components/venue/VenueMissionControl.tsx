/**
 * The TinyFish venue-research surface: live browser deck, venue tabs, activity, and evidence.
 *
 * Inputs: venue research state, the trip's check-in date, and a retry action.
 * Outputs: a live hero frame per venue, an instrument run bar, timestamped activity, the
 * focused source ledger, and checked menu/rate cards.
 * Invariants: every visible line is from an accepted TinyFish frame or checked evidence;
 * all frames stay mounted while hidden; no recording is shown; the plan stays unchanged.
 */

"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Callout, Disclosure, LinkButton } from "@/components/ui";
import { VenueEvidenceCards } from "@/components/venue/VenueEvidenceCards";
import { VenueLiveView } from "@/components/venue/VenueLiveView";
import { VenueWorkerTile } from "@/components/venue/VenueWorkerTile";
import { useNow } from "@/hooks/useNow";
import {
  checkedDate,
  displayOffset,
  formatClock,
  hostOfUrl,
} from "@/lib/venue/format";
import type {
  VenueActivityLine,
  VenueResearchState,
  VenueWorkerState,
} from "@/lib/venue/venueState";

function autoWorker(state: VenueResearchState): string | null {
  const live = state.order.find((id) => state.workers[id]?.phase === "running");
  if (live !== undefined) return live;
  const checked = state.order.find((id) => {
    const worker = state.workers[id];
    return worker?.phase === "complete" && worker.evidence !== null;
  });
  if (checked !== undefined) return checked;
  const error = state.order.find((id) => state.workers[id]?.phase === "error");
  if (error !== undefined) return error;
  return state.order[0] ?? null;
}

interface VenueCounts {
  menus: number;
  hotels: number;
  items: number;
  sources: number;
  actions: number;
}

function countEvidence(state: VenueResearchState): VenueCounts {
  let menus = 0;
  let hotels = 0;
  let items = 0;
  let actions = 0;
  const sourceKeys = new Set<string>();
  for (const id of state.order) {
    const worker = state.workers[id];
    if (worker === undefined) continue;
    if (worker.evidence?.kind === "menu") {
      menus += 1;
      items += worker.evidence.items.length;
    }
    if (worker.evidence?.kind === "hotel") hotels += 1;
    actions += worker.steps;
    for (const source of worker.sources) {
      sourceKeys.add(source.url ?? `title:${source.title ?? ""}`);
    }
  }
  return { menus, hotels, items, sources: sourceKeys.size, actions };
}

interface ActivityRow {
  id: string;
  worker: VenueWorkerState;
  line: VenueActivityLine;
}

function mergedActivity(state: VenueResearchState): ActivityRow[] {
  const rows: ActivityRow[] = [];
  state.order.forEach((id) => {
    const worker = state.workers[id];
    if (worker === undefined) return;
    worker.activity.forEach((line, index) => {
      rows.push({ id: `${id}-${index}`, worker, line });
    });
  });
  rows.sort((a, b) => {
    const left = a.line.ts === null ? 0 : Date.parse(a.line.ts);
    const right = b.line.ts === null ? 0 : Date.parse(b.line.ts);
    return left - right;
  });
  return rows.slice(-10).reverse();
}

function cachedAt(state: VenueResearchState): string | null {
  for (const id of state.order) {
    const evidence = state.workers[id]?.evidence;
    if (evidence !== null && evidence !== undefined) return evidence.retrievedAt;
  }
  return null;
}

function VenueRunStatus({
  state,
  counts,
  cached,
}: {
  state: VenueResearchState;
  counts: VenueCounts;
  cached: boolean;
}) {
  const active = state.status === "running";
  const now = useNow(active);
  const start = state.startedAt === null ? null : Date.parse(state.startedAt);
  const end =
    state.finishedAt !== null
      ? Date.parse(state.finishedAt)
      : active && now > 0
        ? now
        : start;
  const seconds =
    start === null || end === null || !Number.isFinite(start) || !Number.isFinite(end)
      ? 0
      : Math.max(0, Math.floor((end - start) / 1000));
  const completed = state.order.filter(
    (id) => state.workers[id]?.phase === "complete",
  ).length;
  const failed = state.order.filter((id) => state.workers[id]?.phase === "error").length;
  const total = state.order.length;

  return (
    <dl className="mt-4 grid grid-cols-2 border-y border-solid border-hairline-strong md:grid-cols-4">
      <div className="border-b border-r border-solid border-hairline px-3 py-2 md:border-b-0">
        <dt className="t-label text-muted">Pages</dt>
        <dd className="t-data mt-1 text-ink">
          {total === 0
            ? "Resolving"
            : active
              ? `${completed} of ${total} checked`
              : failed > 0
                ? `${completed} checked · ${failed} failed`
                : `${completed} checked`}
        </dd>
      </div>
      <div className="border-b border-solid border-hairline px-3 py-2 md:border-b-0 md:border-r">
        <dt className="t-label text-muted">Clock</dt>
        <dd className="t-data mt-1 text-ink">
          {cached ? "Recorded" : active || seconds > 0 ? formatClock(seconds) : "00:00"}
        </dd>
      </div>
      <div className="border-r border-solid border-hairline px-3 py-2">
        <dt className="t-label text-muted">Evidence</dt>
        <dd className="t-data mt-1 text-ink">
          {counts.menus} {counts.menus === 1 ? "menu" : "menus"} · {counts.hotels}{" "}
          {counts.hotels === 1 ? "quote" : "quotes"} · {counts.items} items
        </dd>
      </div>
      <div className="px-3 py-2">
        <dt className="t-label text-muted">Sources</dt>
        <dd className="t-data mt-1 text-ink">
          {counts.sources} {counts.sources === 1 ? "source" : "sources"} ·{" "}
          {counts.actions} actions
        </dd>
      </div>
    </dl>
  );
}

/** Props for {@link VenueMissionControl}. */
export interface VenueMissionControlProps {
  state: VenueResearchState;
  checkIn: string;
  onRetry: () => void;
  /** True for a sample plan; live TinyFish checks stay off. */
  mock?: boolean;
}

/** The venue-research control surface. */
export function VenueMissionControl({
  state,
  checkIn,
  onRetry,
  mock = false,
}: VenueMissionControlProps) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);
  const auto = autoWorker(state);
  const focused = pinned !== null && state.workers[pinned] !== undefined ? pinned : auto;
  const focusedWorker = focused === null ? null : state.workers[focused];
  const counts = countEvidence(state);
  const completed = state.order.filter(
    (id) => state.workers[id]?.phase === "complete",
  ).length;
  const failed = state.order.filter((id) => state.workers[id]?.phase === "error").length;
  const everyCached =
    state.order.length > 0 &&
    state.order.every((id) => state.workers[id]?.cached === true);
  const activity = mergedActivity(state);
  const recordedAt = cachedAt(state);
  const tabColumns =
    state.order.length === 3
      ? "sm:grid-cols-3"
      : state.order.length >= 5
        ? "sm:grid-cols-2 xl:grid-cols-3"
        : "sm:grid-cols-2";

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (state.order.length === 0) return;
    const index = focused === null ? 0 : state.order.indexOf(focused);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % state.order.length;
    if (event.key === "ArrowLeft") next = (index - 1 + state.order.length) % state.order.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = state.order.length - 1;
    if (next === null) return;
    event.preventDefault();
    const id = state.order[next];
    if (id === undefined) return;
    setPinned(id);
    tabsRef.current?.querySelector<HTMLElement>(`#venue-tab-${id}`)?.focus();
  };

  return (
    <section
      aria-labelledby="venue-deck-heading"
      className="mt-10 border-t border-solid border-ink pt-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="t-label text-muted">TinyFish live research</p>
            {everyCached ? (
              <span className="t-label text-muted">
                Cached{recordedAt === null ? "" : ` · ${checkedDate(recordedAt)}`}
              </span>
            ) : state.status === "running" ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="anim-pulse-dot block h-2 w-2 bg-accent" />
                <span className="t-label text-muted">Browsers live</span>
              </span>
            ) : failed > 0 && completed > 0 ? (
              <span className="t-label text-muted">Partly checked</span>
            ) : null}
          </div>
          <h3 id="venue-deck-heading" className="t-title mt-1 text-ink">
            Menus, room rates, and the pages behind them
          </h3>
          <p className="t-small measure mt-2 text-muted">
            TinyFish opens the exact menu and booking links attached to this plan in real
            browsers, three at a time. The live view is the page itself; the checked cards
            below are the extracted facts. Hotel rates use the trip start date and party
            size.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2">
          <p className="t-data-sm text-muted">
            {counts.menus} {counts.menus === 1 ? "menu" : "menus"} · {counts.hotels}{" "}
            {counts.hotels === 1 ? "room quote" : "room quotes"} · {counts.items} items ·{" "}
            {counts.sources} sources · {counts.actions} actions
          </p>
          {state.status === "complete" || failed > 0 ? (
            <Button variant="secondary" leadingIcon={RefreshCw} onClick={onRetry}>
              Re-run venue checks
            </Button>
          ) : null}
        </div>
      </div>

      <VenueRunStatus state={state} counts={counts} cached={everyCached} />

      {state.status === "complete" && failed > 0 && completed > 0 ? (
        <div className="mt-4">
          <Callout
            tone="caution"
            title={`${failed} venue ${failed === 1 ? "page" : "pages"} could not be checked`}
          >
            <p>
              The checked facts and the plan are unchanged. Retry to open the remaining
              pages again; cached facts return immediately.
            </p>
            <div className="mt-3">
              <Button variant="secondary" onClick={onRetry}>
                Retry venue checks
              </Button>
            </div>
          </Callout>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-4">
          <Callout tone="caution" title="Venue research paused">
            <p>
              {state.error ?? "The venue checks stopped before every page was read."} The
              plan and safety envelope are unchanged.
            </p>
            <div className="mt-3">
              <Button variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            </div>
          </Callout>
        </div>
      ) : null}

      {state.order.length === 0 ? (
        <div className="mt-6 rounded-frame border border-solid border-hairline bg-sunken p-4">
          <p className="t-heading text-ink">
            {mock
              ? "Live venue checks are off for this mock plan"
              : state.status === "complete"
                ? "No venue page was checked for this plan"
                : state.status === "idle"
                  ? "No venue page is attached to this plan"
                  : "Resolving the selected venue pages"}
          </p>
          <p className="t-small measure mt-1 text-muted">
            {mock
              ? "These places, prices, and menus are sample data. Run a live plan to open real venue pages."
              : state.status === "complete"
                ? "Add a start date for a hotel rate, or attach a menu link to a restaurant, then re-run the check."
                : state.status === "idle"
                  ? "Add a restaurant or hotel to the trip, or open a plan that includes one, to check live menus and rates."
                  : "The first browser jobs appear here as soon as the server lists them. The plan is already usable while this runs."}
          </p>
        </div>
      ) : (
        <>
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Venue checks"
            onKeyDown={onTabKeyDown}
            className={`mt-4 grid grid-cols-1 gap-2 border-b border-solid border-hairline pb-3 ${tabColumns}`}
          >
            {state.order.map((id, index) => {
              const worker = state.workers[id];
              if (worker === undefined) return null;
              return (
                <VenueWorkerTile
                  key={id}
                  worker={worker}
                  ordinal={index + 1}
                  selected={id === focused}
                  onSelect={() => setPinned(id)}
                />
              );
            })}
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.5fr)]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="t-data-sm text-muted">
                  {pinned === null
                    ? "Following the browser with the newest action"
                    : `Pinned to ${focusedWorker?.meta.name ?? "a venue"}`}
                </p>
                {pinned === null ? null : (
                  <Button variant="ghost" size="sm" onClick={() => setPinned(null)}>
                    Unpin
                  </Button>
                )}
              </div>
              <div className="mt-2">
                {state.order.map((id) => {
                  const worker = state.workers[id];
                  if (worker === undefined) return null;
                  return (
                    <VenueLiveView
                      key={id}
                      worker={worker}
                      runStartedAt={state.startedAt}
                      visible={id === focused}
                      onRetry={onRetry}
                    />
                  );
                })}
              </div>
            </div>

            <aside className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 border-t border-solid border-hairline-strong pt-2">
                <h4 className="t-label text-muted">Browser activity</h4>
                <p className="t-data-sm text-muted">
                  {state.order.length} {state.order.length === 1 ? "venue" : "venues"}
                </p>
              </div>
              {activity.length === 0 ? (
                <p className="t-small mt-2 text-muted">
                  The first accepted browser action appears here with its elapsed time.
                </p>
              ) : (
                <ol className="mt-2 max-h-[360px] list-none overflow-y-auto p-0">
                  {activity.map((row) => {
                    const offset = displayOffset(
                      state.startedAt,
                      row.line.ts,
                      row.line.offsetSec,
                    );
                    return (
                      <li
                        key={row.id}
                        className="border-b border-solid border-hairline py-2 last:border-b-0"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p className="t-data-sm truncate text-ink">
                            {row.worker.meta.name}
                          </p>
                          <p className="t-data-sm text-muted">
                            {offset === null ? "" : `${offset} · `}
                            {row.line.kind}
                          </p>
                        </div>
                        <p className="t-small mt-1 text-muted">{row.line.text}</p>
                      </li>
                    );
                  })}
                </ol>
              )}

              {focusedWorker !== null ? (
                <div className="mt-4 border-t border-solid border-hairline-strong pt-2">
                  <Disclosure
                    title={`Sources · ${focusedWorker.meta.name}`}
                    summary={`${focusedWorker.sources.length} checked`}
                    open={sourcesOpen}
                    onToggle={() => setSourcesOpen((current) => !current)}
                  >
                    {focusedWorker.sources.length === 0 ? (
                      <p className="t-small text-muted">
                        Sources are listed when the browser exposes them.
                      </p>
                    ) : (
                      <ul className="mt-1 list-none p-0">
                        {focusedWorker.sources.slice(0, 10).map((source, index) => (
                          <li
                            key={`${source.url ?? source.title ?? "source"}-${index}`}
                            className="border-b border-solid border-hairline py-2 last:border-b-0"
                          >
                            <p className="t-small text-ink">
                              {source.title ?? source.url ?? "Source"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                              <p className="t-data-sm text-muted">
                                {hostOfUrl(source.url ?? null, "not linked")} ·{" "}
                                {source.api}
                              </p>
                              {source.url === undefined ? null : (
                                <LinkButton variant="ghost" size="sm" href={source.url}>
                                  Open source
                                </LinkButton>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Disclosure>
                </div>
              ) : null}

              <p className="t-data-sm mt-4 text-muted">
                {state.order.length} pages · 3 browsers at a time · 90s per page
              </p>
            </aside>
          </div>

          <VenueEvidenceCards
            evidence={state.order.flatMap((id) => {
              const worker = state.workers[id];
              return worker?.evidence === null || worker?.evidence === undefined
                ? []
                : [worker.evidence];
            })}
          />
        </>
      )}

      {checkIn.length === 0 ? (
        <p className="t-small measure mt-4 text-muted">
          Add a start date in Edit trip to check hotel rates. Menu pages are still checked
          without a date.
        </p>
      ) : null}

      <p className="t-data-sm measure mt-4 text-muted">
        TinyFish opens the supplied menu or booking URL. No recording is requested. Menu
        facts are cached for 7 days and room rates for 12 hours; re-run to refresh either.
      </p>
    </section>
  );
}
