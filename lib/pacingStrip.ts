/**
 * Pure geometry for the per-day pacing strip.
 *
 * Inputs: an ordered list of itinerary blocks, an internal viewBox width, and the
 * clock hour the modeled day starts (8 by default). Outputs: non-overlapping rects
 * whose x and width are linear in cumulative duration, plus two-hour axis ticks.
 * Invariants: deterministic and DOM-free; the rects tile the full width exactly;
 * every rect stays inside `0..width`; empty or zero-length input returns no rects
 * and no ticks. The component renders this layout; the block list is its text
 * equivalent.
 */

import type { Exertion, ItineraryBlock } from "./healthTripEngine";

/** Modeled start of the itinerary day; the axis and the strip share this hour. */
export const PACING_START_HOUR = 8;

/** Axis ticks are spaced every two hours from the start hour. */
export const PACING_TICK_INTERVAL_HOURS = 2;

/** One block placed on the strip. */
export interface PacingStripRect {
  /** Zero-based position in the source block list. */
  readonly index: number;
  /** Recovery is a short hatched bar; every other block is an ink bar. */
  readonly kind: "exertion" | "recovery";
  /** Left edge in internal viewBox units. */
  readonly x: number;
  /** Width in internal viewBox units, proportional to `durationMin`. */
  readonly width: number;
  /** Minutes from the start of the day to this block. */
  readonly startMinute: number;
  /** Duration in minutes; zero-length blocks keep a zero-width rect. */
  readonly durationMin: number;
  /** Modeled exertion 1-3; recovery bars ignore it. */
  readonly exertion: Exertion;
}

/** One HTML axis label and where it should be anchored. */
export interface PacingStripTick {
  /** Minutes from the start of the day. */
  readonly offsetMinutes: number;
  /** Horizontal position across the strip, from 0 to 1. */
  readonly position: number;
  /** 24-hour label, for example "10:00". */
  readonly label: string;
  /** Anchor used to keep the first and last label inside a narrow column. */
  readonly anchor: "start" | "center" | "end";
}

/** Complete strip geometry consumed by the component. */
export interface PacingStripLayout {
  /** Effective width in internal viewBox units; 0 when the width is invalid. */
  readonly width: number;
  /** Sum of the block durations in minutes. */
  readonly totalMinutes: number;
  /** Ordered rects, none overlapping and none past the width. */
  readonly rects: readonly PacingStripRect[];
  /** Ticks every two hours that fall inside the modeled day. */
  readonly ticks: readonly PacingStripTick[];
}

/** Options for {@link layoutStrip}. */
export interface PacingStripOptions {
  /** Internal viewBox width; must be finite and positive. */
  readonly width: number;
  /** Clock hour the day starts. Defaults to {@link PACING_START_HOUR}. */
  readonly startHour?: number;
}

/** Formats minutes from midnight as a 24-hour HH:MM label. */
export function formatPacingClock(minutesOfDay: number): string {
  const normalized =
    ((Math.round(minutesOfDay) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function startMinuteOfDay(startHour: number): number {
  if (!Number.isFinite(startHour)) return PACING_START_HOUR * 60;
  const minutes = Math.round(startHour * 60);
  return ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
}

function axisTicks(
  totalMinutes: number,
  width: number,
  startHour: number,
): PacingStripTick[] {
  if (totalMinutes <= 0 || width <= 0) return [];
  const interval = PACING_TICK_INTERVAL_HOURS * 60;
  const ticks: PacingStripTick[] = [];
  for (let offsetMinutes = 0; offsetMinutes <= totalMinutes; offsetMinutes += interval) {
    ticks.push({
      offsetMinutes,
      position: offsetMinutes / totalMinutes,
      label: formatPacingClock(startMinuteOfDay(startHour) + offsetMinutes),
      anchor: "center",
    });
  }
  // Anchoring the outer labels inward keeps 11px text inside the column at 375px.
  const first = ticks[0];
  if (first) ticks[0] = { ...first, anchor: "start" };
  const lastIndex = ticks.length - 1;
  if (ticks[lastIndex] && lastIndex > 0) {
    const last = ticks[lastIndex];
    ticks[lastIndex] = {
      ...last,
      anchor: last.position > 0.9 ? "end" : "center",
    };
  }
  return ticks;
}

/**
 * Lay out a day's blocks on a fixed-width strip. Rect edges are computed from
 * cumulative duration so adjacent rects touch without overlapping; the last edge
 * is clamped to `width` so floating-point drift can never overflow the viewBox.
 * A non-positive or non-finite width returns an empty rect list.
 */
export function layoutStrip(
  blocks: readonly ItineraryBlock[],
  options: PacingStripOptions,
): PacingStripLayout {
  const totalMinutes = blocks.reduce(
    (sum, block) => sum + Math.max(0, block.durationMin),
    0,
  );
  if (!Number.isFinite(options.width) || options.width <= 0) {
    return { width: 0, totalMinutes, rects: [], ticks: [] };
  }
  const width = options.width;
  const rects: PacingStripRect[] = [];
  let cursor = 0;
  blocks.forEach((block, index) => {
    const durationMin = Math.max(0, block.durationMin);
    const startMinute = cursor;
    cursor += durationMin;
    const x =
      totalMinutes > 0 ? Math.min(width, (startMinute / totalMinutes) * width) : 0;
    const end =
      totalMinutes > 0 ? Math.min(width, (cursor / totalMinutes) * width) : 0;
    rects.push({
      index,
      kind: block.kind === "recovery" ? "recovery" : "exertion",
      x,
      width: Math.max(0, end - x),
      startMinute,
      durationMin,
      exertion: block.exertion,
    });
  });
  return {
    width,
    totalMinutes,
    rects,
    ticks: axisTicks(
      totalMinutes,
      width,
      options.startHour ?? PACING_START_HOUR,
    ),
  };
}
