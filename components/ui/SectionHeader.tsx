import type { ReactNode } from "react";

/** Props for {@link SectionHeader}. */
export interface SectionHeaderProps {
  /** Two-digit index shown above the title, for example "01". */
  index: string;
  /** Section title. */
  title: string;
  /** Optional right-aligned control such as a filter or link. */
  action?: ReactNode;
  /** Optional id applied to the heading so a section can point at it. */
  id?: string;
}

/**
 * Ruled section heading: a 1px ink rule, the mono index, the serif title, and
 * an optional action at the right. Margins follow the 96px desktop and 64px
 * mobile section rhythm.
 */
export function SectionHeader({ index, title, action, id }: SectionHeaderProps) {
  return (
    <header className="mb-8 mt-16 border-t border-solid border-ink pt-4 md:mt-24">
      <p className="t-label text-muted">{index}</p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-4">
        <h2 id={id} className="t-title">
          {title}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
