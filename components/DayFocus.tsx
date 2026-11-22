/**
 * The day focus control for the finished plan.
 *
 * Inputs: the concierge days, the focused day, and selection handlers.
 * Outputs: an "All days" control, one 44px day button per day, a focus detail strip
 * with the day's model caps and checkpoint, and arrow-key navigation.
 * Invariants: the control only reports values the plan already carries; it never
 * edits a day, and selection is the single source for the map, route, and day plan.
 */

"use client";

import { useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui";
import type { PlannerDay } from "@/lib/agent/agentTypes";

function count(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Props for {@link DayFocus}. */
export interface DayFocusProps {
  days: readonly PlannerDay[];
  activeDay: number | null;
  onSelectDay: (day: number | null) => void;
}

/** A ruled day selector with a live focus strip. */
export function DayFocus({ days, activeDay, onSelectDay }: DayFocusProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const active = days.find((day) => day.day === activeDay) ?? null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      groupRef.current?.querySelectorAll<HTMLElement>('[id^="day-focus-"]') ?? [],
    );
    if (buttons.length === 0) return;
    const current = buttons.findIndex((button) => button === document.activeElement);
    const last = buttons.length - 1;
    let next = current;
    if (event.key === "ArrowRight") next = current < 0 ? 0 : (current + 1) % buttons.length;
    if (event.key === "ArrowLeft") next = current <= 0 ? last : current - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    event.preventDefault();
    buttons[next]?.focus();
    const day = Number(buttons[next]?.id.replace("day-focus-", ""));
    onSelectDay(Number.isFinite(day) ? day : null);
  };

  return (
    <div>
      <div
        ref={groupRef}
        role="group"
        aria-label="Focus one day on the map and route"
        onKeyDown={onKeyDown}
        className="flex flex-wrap items-center gap-2 border-y border-hairline py-2"
      >
        <Button
          variant={activeDay === null ? "primary" : "secondary"}
          aria-pressed={activeDay === null}
          onClick={() => onSelectDay(null)}
        >
          All days
        </Button>
        <div className="flex flex-wrap items-center gap-1">
          {days.map((day) => (
            <Button
              key={day.day}
              id={`day-focus-${day.day}`}
              variant={activeDay === day.day ? "primary" : "secondary"}
              aria-pressed={activeDay === day.day}
              aria-label={`Day ${day.day}: ${day.title}`}
              onClick={() => onSelectDay(activeDay === day.day ? null : day.day)}
            >
              {String(day.day).padStart(2, "0")}
            </Button>
          ))}
        </div>
        <p className="t-data-sm ml-auto text-muted">
          {active === null
            ? `${days.length} days · select a number`
            : `Day ${active.day} of ${days.length}`}
        </p>
      </div>

      <div key={active === null ? "all" : active.day} className="anim-rise mt-3">
        {active === null ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="t-heading text-ink">All days</p>
            <p className="t-data-sm text-muted">
              Select a day number to fit the map and open its route and blocks.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="t-heading min-w-0 text-ink">
                <span className="t-data mr-3 text-muted">
                  {String(active.day).padStart(2, "0")}
                </span>
                {active.title}
              </p>
              <p className="t-data-sm text-muted">
                {count(active.stepEstimate)} / {count(active.stepCeiling)} steps ·{" "}
                {active.walkingKm.toFixed(1)} / {active.walkingCapKm.toFixed(1)} km ·{" "}
                {active.recoveryMinutes} min recovery
              </p>
            </div>
            <p className="t-small measure mt-1 text-muted">{active.checkpoint}</p>
            {active.withinCaps ? null : (
              <p className="t-small mt-1 text-risk">
                This day is above its modeled ceiling. Follow the pacing limits in the
                safety envelope.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
