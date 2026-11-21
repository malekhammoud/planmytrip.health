/**
 * Metric comparison bar geometry.
 * Inputs: this plan's value and a baseline value, both unitless counts.
 * Outputs: widths for the two bars as percentages of the larger value.
 * Invariants: the larger value always fills 100% of the row, both widths stay
 * between 0 and 100, and negative or non-finite inputs behave as 0.
 */

/** Widths, in percent, for the two metric comparison bars. */
export interface MetricBarWidths {
  /** Width of the bar for this plan's value. */
  thisPlan: number;
  /** Width of the bar for the baseline value. */
  baseline: number;
}

/**
 * Returns the two comparison bar widths, scaled against the larger value.
 *
 * @param thisPlan - Value for the planned trip.
 * @param baseline - Value for the comparison baseline.
 * @returns Percent widths for both bars. Returns zeros when both values are 0.
 */
export function metricBarWidths(thisPlan: number, baseline: number): MetricBarWidths {
  const plan = Number.isFinite(thisPlan) ? Math.max(0, thisPlan) : 0;
  const base = Number.isFinite(baseline) ? Math.max(0, baseline) : 0;
  const largest = Math.max(plan, base);

  if (largest <= 0) {
    return { thisPlan: 0, baseline: 0 };
  }

  return {
    thisPlan: (plan / largest) * 100,
    baseline: (base / largest) * 100,
  };
}
