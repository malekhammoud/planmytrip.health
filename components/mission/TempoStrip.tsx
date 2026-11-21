/**
 * Inline tempo strip derived only from accepted progress steps.
 *
 * Inputs: counts per five-second bucket, a height, and whether to draw time ticks.
 * Outputs: an SVG with ink bars, the current bucket in accent, and a hairline baseline.
 * Invariants: no bars are invented; an empty run draws only the baseline and copy.
 */

import type { CSSProperties } from "react";

/** Props for {@link TempoStrip}. */
export interface TempoStripProps {
  /** Counts from `tempoBuckets`, oldest bucket first. */
  buckets: readonly number[];
  /** Pixel height; 24 is the tile strip, 48 the focus strip. */
  height?: number;
  /** Draws mono time ticks under the focus strip. */
  ticks?: boolean;
  /** Accessible description of the strip. */
  label?: string;
}

const BAR_WIDTH = 6;
const BAR_GAP = 3;

function barHeight(value: number, max: number, height: number): number {
  if (max <= 0) return 2;
  return Math.max(2, Math.round((value / max) * (height - 2)));
}

/** Bars are decorative; the accessible label names the real counts. */
export function TempoStrip({
  buckets,
  height = 24,
  ticks = false,
  label,
}: TempoStripProps) {
  const max = Math.max(1, ...buckets);
  const width = Math.max(24, buckets.length * (BAR_WIDTH + BAR_GAP));
  const viewHeight = height + (ticks ? 16 : 0);
  // Intrinsic width keeps every bar exactly 6px; the strip is a sparkline, not a
  // full-width chart, and max-width keeps it inside a phone.
  const style = {
    width: `${width}px`,
    maxWidth: "100%",
    height: viewHeight,
  } as CSSProperties;

  return (
    <div>
      <svg
        role="img"
        aria-label={label ?? `Activity tempo, ${buckets.length} buckets`}
        viewBox={`0 0 ${width} ${viewHeight}`}
        className="block"
        style={style}
      >
        <line
          x1={0}
          y1={height}
          x2={width}
          y2={height}
          className="stroke-hairline"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {buckets.map((value, index) => {
          const bar = barHeight(value, max, height);
          const current = index === buckets.length - 1;
          return (
            <rect
              key={index}
              x={index * (BAR_WIDTH + BAR_GAP)}
              y={height - bar}
              width={BAR_WIDTH}
              height={bar}
              className={current ? "fill-accent" : "fill-ink"}
            />
          );
        })}
        {ticks
          ? [0, 1, 2, 3, 4].map((tick) => {
              const x = (tick / 4) * width;
              return (
                <text
                  key={tick}
                  x={x}
                  y={height + 12}
                  textAnchor={tick === 0 ? "start" : tick === 4 ? "end" : "middle"}
                  className="t-data-sm fill-muted"
                >
                  {tick === 0 ? "start" : `${tick * 5}s`}
                </text>
              );
            })
          : null}
      </svg>
      {buckets.length === 0 ? (
        <p className="t-data-sm mt-1 text-muted">No steps yet.</p>
      ) : null}
    </div>
  );
}
