import type { ReactNode } from "react";

/** Tone of a {@link Callout}, mapped to the 3px left bar and the live region role. */
export type CalloutTone = "info" | "caution" | "risk";

/** Props for {@link Callout}. */
export interface CalloutProps {
  /** Message tone. Risk callouts are announced as alerts. */
  tone: CalloutTone;
  /** Short heading in the heading type. */
  title: string;
  /** Body copy in the small type. */
  children: ReactNode;
}

const TONE_BAR_CLASSES: Record<CalloutTone, string> = {
  info: "bg-accent",
  caution: "bg-caution-bar",
  risk: "bg-risk",
};

/**
 * Bordered note on the surface color with a 3px tone bar at the left. Risk
 * notes use `role="alert"`; info and caution notes use `role="status"`.
 */
export function Callout({ tone, title, children }: CalloutProps) {
  return (
    <div
      role={tone === "risk" ? "alert" : "status"}
      className="relative overflow-hidden rounded-frame border border-solid border-hairline bg-surface p-4"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[3px] ${TONE_BAR_CLASSES[tone]}`}
      />
      <p className="t-heading text-ink">{title}</p>
      <div className="t-small mt-1 text-ink">{children}</div>
    </div>
  );
}
