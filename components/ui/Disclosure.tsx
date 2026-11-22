import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Heading level for a section-level disclosure; row disclosures omit it. */
export type DisclosureLevel = 2 | 3 | 4;

/** Props for {@link Disclosure}. */
export interface DisclosureProps {
  /** Visible label. Section disclosures use a sentence-case label. */
  title: string;
  /** Short status or count shown beside the title. */
  summary?: ReactNode;
  /** Controlled open state. */
  open: boolean;
  onToggle: () => void;
  /** Content stays mounted when closed; inert prevents focus and pointer access. */
  children: ReactNode;
  /** Optional action rendered beside the header, never inside the button. */
  action?: ReactNode;
  /** Uses a real heading for section-level disclosures. */
  level?: DisclosureLevel;
  /** Optional id for the body; generated when omitted. */
  id?: string;
  className?: string;
}

/**
 * A mounted, accessible disclosure. The body uses a grid-row transition so it can
 * collapse without unmounting live streams or iframes. Reduced motion makes the
 * transition instant; the static content is always available when opened.
 */
export function Disclosure({
  title,
  summary,
  open,
  onToggle,
  children,
  action,
  level,
  id,
  className,
}: DisclosureProps) {
  const generated = useId();
  const bodyId = id ?? `disclosure-${generated.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const header = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={bodyId}
      onClick={onToggle}
      className="disclosure__button"
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="t-label text-muted">{title}</span>
        {summary === undefined ? null : (
          <span className="t-data-sm text-muted">{summary}</span>
        )}
      </span>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        className={`disclosure__icon shrink-0 ${open ? "disclosure__icon--open" : ""}`}
      />
    </button>
  );

  const Heading = level === undefined ? null : (`h${level}` as const);

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        {Heading === null ? (
          header
        ) : (
          <Heading className="min-w-0 flex-1">{header}</Heading>
        )}
        {action === undefined ? null : <div className="shrink-0">{action}</div>}
      </div>
      <div
        id={bodyId}
        className="disclosure__body"
        data-open={open ? "true" : "false"}
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
      >
        <div className="disclosure__inner">{children}</div>
      </div>
    </div>
  );
}
