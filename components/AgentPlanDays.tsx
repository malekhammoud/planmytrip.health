"use client";

import type { CSSProperties } from "react";
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

function CapLine({ day }: { day: PlannerDay }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
      <div>
        <p className="t-label text-muted">Steps · estimate / ceiling</p>
        <p className="t-data mt-1 text-ink">
          {count(day.stepEstimate)} / {count(day.stepCeiling)}
        </p>
      </div>
      <div>
        <p className="t-label text-muted">Walking · estimate / ceiling</p>
        <p className="t-data mt-1 text-ink">
          {day.walkingKm.toFixed(1)} / {day.walkingCapKm.toFixed(1)} km
        </p>
      </div>
      <div>
        <p className="t-label text-muted">Recovery</p>
        <p className="t-data mt-1 text-ink">{day.recoveryMinutes} min</p>
      </div>
    </div>
  );
}

/** One concierge day as a hairline row with its modeled safety ceiling. */
function DayRow({ day, index }: { day: PlannerDay; index: number }) {
  const style = { "--day-index": index } as CSSProperties;
  return (
    <li className="day-row border-t border-hairline py-8" style={style}>
      <div className="mx-auto grid max-w-full gap-6 md:grid-cols-[64px_minmax(0,1fr)] md:gap-8">
        <p aria-hidden="true" className="t-metric-day text-ink">
          {String(day.day).padStart(2, "0")}
        </p>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h4 className="t-heading text-ink">
              <span className="sr-only">Day {day.day}: </span>
              {day.title}
            </h4>
            {day.restDay ? (
              <span className="t-label rounded-frame bg-accent-soft px-2 py-1 text-ink">
                Rest day
              </span>
            ) : null}
            {day.area ? <span className="t-data text-muted">{day.area}</span> : null}
          </div>
          <CapLine day={day} />
          {!day.withinCaps ? (
            <p className="t-small mt-3 text-risk">
              This estimate exceeds the modeled ceiling. Follow the Pacing limits.
            </p>
          ) : null}
          {day.blocks.length > 0 ? (
            <ol className="mt-4 list-none p-0">
              {day.blocks.map((block, blockIndex) => (
                <BlockRow key={`${blockIndex}-${block.time}-${block.title}`} block={block} />
              ))}
            </ol>
          ) : (
            <p className="t-small mt-4 text-muted">No blocks were returned for this day.</p>
          )}
          <div className="mt-5 rounded-frame bg-accent-soft p-3">
            <p className="t-label text-muted">Checkpoint</p>
            <p className="t-small mt-1 text-ink">{day.checkpoint}</p>
          </div>
        </div>
      </div>
    </li>
  );
}

/** The concierge's day-by-day timeline. */
export function AgentPlanDays({ days }: { days: readonly PlannerDay[] }) {
  return (
    <ol aria-label="Concierge day plan" className="list-none p-0">
      {days.map((day, index) => (
        <DayRow key={day.day} day={day} index={index} />
      ))}
    </ol>
  );
}
