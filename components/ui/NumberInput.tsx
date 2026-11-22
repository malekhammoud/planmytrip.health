/**
 * Numeric field for a small integer range.
 *
 * Inputs: a controlled integer value, inclusive bounds, and Field accessibility bindings.
 * Outputs: onValueChange for every valid integer and a clamped value when focus leaves.
 * Invariants: typing an out-of-range draft never writes an invalid value upstream; leaving
 * the field resets the visible text to the clamped integer; an external value change updates
 * the input whenever it is not focused.
 */

"use client";

import { useEffect } from "react";
import { TextInput } from "./TextInput";
import { clampInteger } from "./numberInput";

/** Props for {@link NumberInput}. */
export interface NumberInputProps {
  /** Required id that binds the Field label. */
  id: string;
  /** Current committed value. */
  value: number;
  /** Lowest allowed integer. */
  min: number;
  /** Highest allowed integer. */
  max: number;
  /** Called with a valid integer inside the range. */
  onValueChange: (value: number) => void;
  /** Supporting hint or error ids supplied by Field. */
  "aria-describedby"?: string;
  /** True when the bound Field shows an error. */
  "aria-invalid"?: boolean;
}

/** A bounded integer input that keeps an invalid draft out of the trip config. */
export function NumberInput({
  id,
  value,
  min,
  max,
  onValueChange,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: NumberInputProps) {
  useEffect(() => {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement && document.activeElement !== input) {
      input.value = String(value);
    }
  }, [id, value]);

  const commitOnBlur = (input: HTMLInputElement): void => {
    const next = clampInteger(Number(input.value), min, max);
    input.value = String(next);
    if (next !== value) onValueChange(next);
  };

  return (
    <TextInput
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      defaultValue={value}
      autoComplete="off"
      aria-describedby={describedBy}
      aria-invalid={invalid === true ? true : undefined}
      onChange={(event) => {
        const next = Number(event.currentTarget.value);
        if (Number.isInteger(next) && next >= min && next <= max) {
          onValueChange(next);
        }
      }}
      onBlur={(event) => commitOnBlur(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commitOnBlur(event.currentTarget);
      }}
    />
  );
}
