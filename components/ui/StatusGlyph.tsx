import { Check, CircleAlert } from "lucide-react";

/** The five agent and record states shown by {@link StatusGlyph}. */
export type StatusGlyphState = "queued" | "running" | "done" | "error" | "notfound";

/** Props for {@link StatusGlyph}. */
export interface StatusGlyphProps {
  /** Which state shape to draw. */
  state: StatusGlyphState;
  /** Visible, always-present text that carries the meaning. */
  label: string;
}

/**
 * 16px state marker paired with a visible label. The shape is hidden from
 * assistive technology; the label is the accessible text.
 */
export function StatusGlyph({ state, label }: StatusGlyphProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
        {state === "queued" ? (
          <span className="block h-4 w-4 rounded-full border border-solid border-muted" />
        ) : state === "running" ? (
          <span className="status-pulse block h-2 w-2 rounded-full bg-accent" />
        ) : state === "done" ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-paper">
            <Check size={10} strokeWidth={3} />
          </span>
        ) : state === "error" ? (
          <CircleAlert size={16} strokeWidth={1.75} className="text-risk" />
        ) : (
          <span className="block h-0.5 w-2 bg-muted" />
        )}
      </span>
      <span className="t-small text-ink">{label}</span>
    </span>
  );
}
