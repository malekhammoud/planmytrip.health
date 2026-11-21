"use client";

import { useId } from "react";
import type { ItineraryBlock } from "@/lib/healthTripEngine";
import { formatPacingClock, layoutStrip, PACING_START_HOUR } from "@/lib/pacingStrip";

const VIEWBOX_WIDTH = 640;
const PLOT_HEIGHT = 64;
const RECOVERY_HEIGHT = 12;

/** Props for {@link PacingStrip}. */
export interface PacingStripProps {
  /** Ordered blocks for one itinerary day. */
  blocks: readonly ItineraryBlock[];
  /** Day number used in the image label. */
  day: number;
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildAriaLabel(
  day: number,
  blocks: readonly ItineraryBlock[],
  totalMinutes: number,
): string {
  if (blocks.length === 0) return `Day ${day} pacing: no activity blocks`;
  const recovery = blocks.filter((block) => block.kind === "recovery").length;
  const exertion = blocks.length - recovery;
  const start = PACING_START_HOUR * 60;
  return `Day ${day} pacing from ${formatPacingClock(start)} to ${formatPacingClock(start + totalMinutes)}: ${pluralize(exertion, "exertion block", "exertion blocks")}, ${pluralize(recovery, "recovery block", "recovery blocks")}`;
}

function labelTransform(anchor: "start" | "center" | "end"): string | undefined {
  if (anchor === "center") return "translateX(-50%)";
  if (anchor === "end") return "translateX(-100%)";
  return undefined;
}

/**
 * The per-day pacing strip: exertion bars scaled to the 64px plot, recovery
 * blocks as short hatched bars on the baseline, and a two-hour axis in an HTML
 * row so the 11px labels never scale with the SVG. The block list beside it is
 * the text equivalent; the SVG carries only the summary label.
 */
export function PacingStrip({ blocks, day }: PacingStripProps) {
  const rawId = useId();
  const hatchId = `pacing-hatch-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const layout = layoutStrip(blocks, {
    width: VIEWBOX_WIDTH,
    startHour: PACING_START_HOUR,
  });

  return (
    <figure className="mt-4">
      <svg
        role="img"
        aria-label={buildAriaLabel(day, blocks, layout.totalMinutes)}
        focusable="false"
        preserveAspectRatio="none"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${PLOT_HEIGHT}`}
        className="block h-16 w-full"
      >
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--accent-soft)" />
            <line
              x1="0"
              y1="6"
              x2="6"
              y2="0"
              stroke="var(--accent)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>
        {layout.rects.map((rect) => {
          // A half-unit inset per side keeps adjacent same-height bars legible.
          const inset = rect.width > 1 ? 0.5 : 0;
          const width = Math.max(0, rect.width - inset * 2);
          if (rect.kind === "recovery") {
            return (
              <rect
                key={rect.index}
                className="pacing-recovery"
                x={0}
                y={PLOT_HEIGHT - RECOVERY_HEIGHT}
                width={VIEWBOX_WIDTH}
                height={RECOVERY_HEIGHT}
                fill={`url(#${hatchId})`}
                style={{
                  transform: `translateX(${rect.x + inset}px) scaleX(${width / VIEWBOX_WIDTH})`,
                }}
              />
            );
          }
          return (
            <rect
              key={rect.index}
              className="pacing-bar"
              x={rect.x + inset}
              y={0}
              width={width}
              height={PLOT_HEIGHT}
              fill="var(--ink)"
              style={{ transform: `scaleY(${rect.exertion / 3})` }}
            />
          );
        })}
        <line
          x1="0"
          y1={PLOT_HEIGHT - 0.5}
          x2={VIEWBOX_WIDTH}
          y2={PLOT_HEIGHT - 0.5}
          stroke="var(--hairline-strong)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div aria-hidden="true" className="relative mt-1 h-4">
        {layout.ticks.map((tick) => (
          <span
            key={`${tick.offsetMinutes}-${tick.label}`}
            className="t-data-sm absolute top-0 whitespace-nowrap text-muted"
            style={{
              left: `${tick.position * 100}%`,
              transform: labelTransform(tick.anchor),
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="t-small flex items-center gap-2 text-muted">
          <span aria-hidden="true" className="h-2 w-3 bg-ink" />
          Exertion
        </span>
        <span className="t-small flex items-center gap-2 text-muted">
          <svg aria-hidden="true" width="12" height="8" viewBox="0 0 12 8">
            <defs>
              <pattern
                id={`${hatchId}-legend`}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
              >
                <rect width="6" height="6" fill="var(--accent-soft)" />
                <line
                  x1="0"
                  y1="6"
                  x2="6"
                  y2="0"
                  stroke="var(--accent)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="12" height="8" fill={`url(#${hatchId}-legend)`} />
          </svg>
          Recovery
        </span>
      </figcaption>
    </figure>
  );
}
