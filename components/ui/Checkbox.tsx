import { Check } from "lucide-react";

/** Props for {@link Checkbox}. */
export interface CheckboxProps {
  /** Required id that binds the label element. */
  id: string;
  /** Visible label text; the whole 44px row is the hit target. */
  label: string;
  /** Controlled checked state. */
  checked: boolean;
  /** Called with the next checked state. */
  onChange: (checked: boolean) => void;
  /** Disables the control and blocks pointer and keyboard activation. */
  disabled?: boolean;
  /** Ids of supporting hint or error text. */
  describedBy?: string;
}

/**
 * Native checkbox with a custom 20px square. The input stays in the accessible
 * tree but visually hidden, so keyboard focus draws its 2px accent outline on
 * the custom box instead.
 */
export function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  describedBy,
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={[
        "inline-flex min-h-11 select-none items-center gap-3",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
      ].join(" ")}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-frame border border-solid border-ink text-paper transition-colors duration-150",
          "peer-checked:bg-ink",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
        ].join(" ")}
      >
        {checked ? <Check size={12} strokeWidth={2.5} /> : null}
      </span>
      <span className="t-body text-ink">{label}</span>
    </label>
  );
}
