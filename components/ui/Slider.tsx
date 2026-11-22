import { sliderFillPercent } from "./sliderFill";

/** Props for {@link Slider}. */
export interface SliderProps {
  /** Current value. */
  value: number;
  /** Lowest allowed value. */
  min: number;
  /** Highest allowed value. */
  max: number;
  /** Called with the next numeric value when the thumb moves. */
  onChange: (value: number) => void;
  /** Accessible name for the range input. */
  ariaLabel: string;
  /** Human-readable value announcement, for example "Day 4 of 14". */
  ariaValueText?: string;
  /** Increment between allowed values. Defaults to 1. */
  step?: number;
  /** Optional labels for each integer tick, in order from min to max. */
  tickLabels?: readonly string[];
  /** Optional id, for example from Field. */
  id?: string;
  /** Supporting hint or error ids supplied by Field. */
  ariaDescribedBy?: string;
  /** True when the bound Field is showing an error. */
  ariaInvalid?: boolean;
}

/**
 * Native range input restyled as a 2px ruled track with an ink fill and a
 * 20px ink thumb. Integer ticks sit beneath the track; the current value is
 * the only tick in ink at weight 500.
 */
export function Slider({
  value,
  min,
  max,
  onChange,
  ariaLabel,
  ariaValueText,
  step = 1,
  tickLabels,
  id,
  ariaDescribedBy,
  ariaInvalid,
}: SliderProps) {
  const fill = sliderFillPercent(value, min, max);
  const ticks: number[] = [];
  for (let tick = Math.ceil(min); tick <= Math.floor(max); tick += 1) {
    ticks.push(tick);
  }

  return (
    <div className="w-full">
      <div className="relative flex h-11 items-center">
        <div className="pointer-events-none absolute inset-x-2.5 top-1/2 h-0.5 -translate-y-1/2">
          <span aria-hidden="true" className="absolute inset-0 bg-hairline-strong" />
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 h-0.5 bg-ink"
            style={{ width: `${fill}%` }}
          />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={ariaLabel}
          aria-valuetext={ariaValueText}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          className="slider-range relative z-10 w-full"
        />
      </div>
      <div aria-hidden="true" className="mx-2.5 mt-2 flex justify-between">
        {ticks.map((tick) => (
          <span
            key={tick}
            className={
              tick === value ? "t-data-sm font-medium text-ink" : "t-data-sm text-muted"
            }
          >
            {tickLabels?.[tick - min] ?? tick}
          </span>
        ))}
      </div>
    </div>
  );
}
