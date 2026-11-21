"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { metricBarWidths } from "./metricBars";

/** The optional two-bar comparison shown beneath a {@link Metric}. */
export interface MetricCompare {
  /** Value for the planned trip. */
  thisPlan: number;
  /** Value for the comparison baseline. */
  baseline: number;
  /** Caption for the comparison bar. Defaults to "Baseline". */
  baselineLabel?: string;
}

/** Props for {@link Metric}. */
export interface MetricProps {
  /** Small mono label above the value. */
  label: string;
  /** Large serif value. */
  value: string | number;
  /** Optional unit rendered in mono beside the value and in comparisons. */
  unit?: string;
  /** Optional supporting line below the value. */
  sub?: string;
  /** Optional two-bar comparison against a baseline. */
  compare?: MetricCompare;
  /** Optional tooltip text, revealed on hover or keyboard focus and dismissed with Escape. */
  info?: string;
}

interface CompareBarsProps {
  thisPlan: number;
  baseline: number;
  unit?: string;
  baselineLabel?: string;
}

function displayWithUnit(value: number, unit?: string): string {
  return unit ? `${value} ${unit}` : String(value);
}

function CompareBars({ thisPlan, baseline, unit, baselineLabel = "Baseline" }: CompareBarsProps) {
  const widths = metricBarWidths(thisPlan, baseline);

  return (
    <div className="mt-4 space-y-2">
      <div>
        <div aria-hidden="true" className="h-1 bg-ink" style={{ width: `${widths.thisPlan}%` }} />
        <p className="mt-1 flex items-baseline gap-1">
          <span className="t-label text-muted">This plan</span>
          <span className="t-data-sm text-ink">{displayWithUnit(thisPlan, unit)}</span>
        </p>
      </div>
      <div>
        <div
          aria-hidden="true"
          className="h-1 bg-hairline-strong"
          style={{ width: `${widths.baseline}%` }}
        />
        <p className="mt-1 flex items-baseline gap-1">
          <span className="t-label text-muted">{baselineLabel}</span>
          <span className="t-data-sm text-ink">{displayWithUnit(baseline, unit)}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Single quantity with a mono label, serif value, optional unit, supporting
 * line, baseline comparison bars, and an accessible info tooltip.
 */
export function Metric({ label, value, unit, sub, compare, info }: MetricProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [clicked, setClicked] = useState(false);
  const tooltipId = useId();
  const visible = hovered || focused || clicked;

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setHovered(false);
        setFocused(false);
        setClicked(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-1">
        <p className="t-label text-muted">{label}</p>
        {info ? (
          <span className="inline-flex">
            <button
              type="button"
              aria-label={`About ${label}`}
              aria-describedby={visible ? tooltipId : undefined}
              onClick={() => setClicked((current) => !current)}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                setClicked(false);
              }}
              className="relative inline-flex h-4 w-4 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-muted transition-colors duration-150 before:absolute before:-inset-3.5 hover:text-ink"
            >
              <Info size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="t-metric text-ink">{value}</span>
        {unit ? <span className="t-data text-muted">{unit}</span> : null}
      </div>
      {sub ? <p className="t-small mt-1 text-muted">{sub}</p> : null}
      {compare ? (
        <CompareBars
          thisPlan={compare.thisPlan}
          baseline={compare.baseline}
          unit={unit}
          baselineLabel={compare.baselineLabel}
        />
      ) : null}
      {info && visible ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-full z-10 mt-2 w-64 max-w-[calc(100vw-48px)] rounded-frame border border-solid border-hairline bg-surface p-3 t-small text-ink"
        >
          {info}
        </span>
      ) : null}
    </div>
  );
}
