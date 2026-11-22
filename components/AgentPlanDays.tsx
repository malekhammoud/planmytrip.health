"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui";
import type { PlannerDay, PlannerDayBlock } from "@/lib/agent/agentTypes";

function count(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function duration(minutes: number): string {
  if (minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function BlockRow({ block }: { block: PlannerDayBlock }) {
  return (
    <li className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-t border-hairline py-3 first:border-t-0">
      <div>
        <p className="t-data text-ink">{block.time || "—"}</p>
        <p className="t-label mt-1 text-muted">{block.kind}</p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="t-body text-ink">{block.title}</p>
          <p className="t-data-sm text-muted">{duration(block.durationMin)}</p>
        </div>
        {block.detail ? (
          <p className="t-small mt-1 text-muted [overflow-wrap:anywhere]">{block.detail}</p>
        ) : null}
      </div>
    </li>
  );
}

/** One concierge day: a compact ruled row that opens into its blocks and checkpoint. */
function DayRow({
  day,
  index,
  open,
  onToggle,
  onShowOnMap,
}: {
  day: PlannerDay;
  index: number;
  open: boolean;
  onToggle: () => void;
  onShowOnMap: () => void;
}) {
  const style = { "--day-index": index } as CSSProperties;
  const detailId = `plan-day-${day.day}`;
  return (
    <li
      className={`day-row py-5 ${open ? "border-t-2 border-t-accent" : "border-t border-hairline"}`}
      style={style}
    >
      <div className="grid max-w-full gap-4 md:grid-cols-[64px_minmax(0,1fr)] md:gap-6">
        <p aria-hidden="true" className="t-metric-day text-ink">
          {String(day.day).padStart(2, "0")}
        </p>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h4 className="t-heading min-w-0 text-ink">
              <span className="sr-only">Day {day.day}: </span>
              {day.title}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={onToggle}
            >
              {open ? "Close day" : "Open day"}
            </Button>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {day.restDay ? (
              <span className="t-label rounded-frame bg-accent-soft px-2 py-1 text-ink">
                Rest day
              </span>
            ) : null}
            {day.area ? <span className="t-data-sm text-muted">{day.area}</span> : null}
            <span className="t-data-sm text-muted">
              {count(day.stepEstimate)} / {count(day.stepCeiling)} steps ·{" "}
              {day.walkingKm.toFixed(1)} / {day.walkingCapKm.toFixed(1)} km ·{" "}
              {day.recoveryMinutes} min recovery
            </span>
          </div>
          {!day.withinCaps ? (
            <p className="t-small mt-2 text-risk">
              This day is above its modeled ceiling. Follow the Pacing limits.
            </p>
          ) : null}

          <div id={detailId} hidden={!open} className="anim-fade">
            {day.blocks.length > 0 ? (
              <ol className="mt-3 list-none p-0">
                {day.blocks.map((block, blockIndex) => (
                  <BlockRow key={`${blockIndex}-${block.time}-${block.title}`} block={block} />
                ))}
              </ol>
            ) : (
              <p className="t-small mt-3 text-muted">No blocks were returned for this day.</p>
            )}
            <div className="mt-4 rounded-frame bg-accent-soft p-3">
              <p className="t-label text-muted">Checkpoint</p>
              <p className="t-small mt-1 text-ink">{day.checkpoint}</p>
              <div className="mt-2">
                <Button variant="ghost" size="sm" onClick={onShowOnMap}>
                  Show day {day.day} on the map
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/** Props for {@link AgentPlanDays}. */
export interface AgentPlanDaysProps {
  days: readonly PlannerDay[];
  /** The focused day; its row is open and ruled in accent. */
  activeDay?: number | null;
  onSelectDay?: (day: number | null) => void;
  /** Selects a day and brings the map into view. */
  onShowOnMap?: (day: number) => void;
}

/** The concierge's day-by-day timeline, open on the focused day only. */
export function AgentPlanDays({
  days,
  activeDay = null,
  onSelectDay,
  onShowOnMap,
}: AgentPlanDaysProps) {
  const visible =
    activeDay === null ? days : days.filter((day) => day.day === activeDay);
  return (
    <ol aria-label="Concierge day plan" className="mt-2 list-none p-0">
      {visible.map((day) => (
        <DayRow
          key={day.day}
          day={day}
          index={days.findIndex((entry) => entry.day === day.day)}
          open={activeDay === day.day}
          onToggle={() => onSelectDay?.(activeDay === day.day ? null : day.day)}
          onShowOnMap={() => onShowOnMap?.(day.day)}
        />
      ))}
    </ol>
  );
}
