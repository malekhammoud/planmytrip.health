/**
 * Client hooks for the plan-change motion.
 *
 * Inputs: a numeric KPI or a new HealthTripPlan.
 * Outputs: a 300ms eased value, or the KPI diffs to show for four seconds.
 * Invariants: the clock only runs after a real value change; reduced motion returns the
 * final value immediately; no timer survives a newer change or unmount.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  PLAN_TWEEN_MS,
  detectPlanDiffs,
  tweenValue,
  type PlanDiff,
} from "@/lib/planMotion";
import type { HealthTripPlan } from "@/lib/healthTripEngine";

/** Eases one displayed number toward a new value. */
export function useTweenedNumber(value: number, duration = PLAN_TWEEN_MS): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const previousRef = useRef(value);

  useEffect(() => {
    const from = previousRef.current;
    previousRef.current = value;
    if (reduced || from === value) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(tweenValue(from, value, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return reduced ? value : display;
}

/** Shows changed KPI values for four seconds after a plan change. */
export function usePlanDiffs(plan: HealthTripPlan): PlanDiff[] {
  const [diffs, setDiffs] = useState<PlanDiff[]>([]);
  const previousRef = useRef(plan);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = plan;
    if (previous === plan) return;
    const next = detectPlanDiffs(previous, plan);
    if (next.length === 0) return;
    const show = setTimeout(() => setDiffs(next), 0);
    const hide = setTimeout(() => setDiffs([]), 4000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [plan]);

  return diffs;
}
