/**
 * Pure motion helpers for plan changes.
 *
 * Inputs: a 0-1 progress value or two engine plans.
 * Outputs: eased values and a typed list of changed KPI fields.
 * Invariants: progress is clamped, easing is monotonic from 0 to 1, and only the three
 * displayed KPI numbers are diffed; unchanged plans return an empty list.
 */

import type { HealthTripPlan } from "@/lib/healthTripEngine";

/** Duration of the KPI number tween. */
export const PLAN_TWEEN_MS = 300;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Cubic ease-out: fast start, calm settle, exact 0 and 1 endpoints. */
export function easeOutCubic(progress: number): number {
  const value = clamp01(progress);
  return 1 - (1 - value) ** 3;
}

/** Interpolates between two numbers with the shared easing curve. */
export function tweenValue(from: number, to: number, progress: number): number {
  return from + (to - from) * easeOutCubic(progress);
}

/** One changed KPI value. */
export interface PlanDiff {
  key: "healthSafetyScore" | "dailyStepCeiling" | "riskReductionPct";
  label: string;
  from: number;
  to: number;
  unit: string;
  /** Ready-to-render sentence such as "Step ceiling 6,000 to 5,000 steps". */
  text: string;
}

function count(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const FIELDS: readonly {
  key: PlanDiff["key"];
  label: string;
  unit: string;
}[] = [
  { key: "healthSafetyScore", label: "Health safety score", unit: "/100" },
  { key: "dailyStepCeiling", label: "Step ceiling", unit: "steps" },
  { key: "riskReductionPct", label: "Risk reduction", unit: "%" },
];

function diffText(field: (typeof FIELDS)[number], from: number, to: number): string {
  if (field.unit === "steps") {
    return `${field.label} ${count(from)} to ${count(to)} steps`;
  }
  if (field.unit === "/100") {
    return `${field.label} ${count(from)}/100 to ${count(to)}/100`;
  }
  return `${field.label} ${count(from)}% to ${count(to)}%`;
}

/** Returns one entry per KPI number that changed between two plans. */
export function detectPlanDiffs(
  previous: HealthTripPlan,
  next: HealthTripPlan,
): PlanDiff[] {
  const diffs: PlanDiff[] = [];
  for (const field of FIELDS) {
    const from = previous[field.key];
    const to = next[field.key];
    if (from === to) continue;
    diffs.push({
      key: field.key,
      label: field.label,
      from,
      to,
      unit: field.unit,
      text: diffText(field, from, to),
    });
  }
  return diffs;
}
