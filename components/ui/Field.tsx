import type { ReactNode } from "react";

/** Bindings that {@link Field} supplies to its render-prop control. */
export interface FieldControlProps {
  /** Id the control must apply so the label points at it. */
  id: string;
  /** Space-separated hint and error ids to apply to the control. */
  "aria-describedby"?: string;
  /** True when the field currently shows an error. */
  "aria-invalid"?: boolean;
}

/** Props for {@link Field}. */
export interface FieldProps {
  /** Explicit id for the control; the label and descriptions derive from it. */
  id: string;
  /** Visible label rendered in `.t-label` above the control. */
  label: string;
  /** Optional guidance rendered below the control. */
  hint?: string;
  /** Optional error rendered below the control in the risk tone. */
  error?: string;
  /** Receives the ids and aria flags to spread onto the control. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label, control, hint, and error wiring for a single form field. The control
 * is supplied as a render prop so TextInput and Select share one accessible
 * description contract.
 */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="t-label text-ink">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hintId ? (
        <p id={hintId} className="t-small text-muted">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <p id={errorId} role="alert" className="t-small text-risk">
          {error}
        </p>
      ) : null}
    </div>
  );
}
