import type { ReactNode } from "react";

/** Props for {@link DataRow}. */
export interface DataRowProps {
  /** Label rendered in the 120px mono column. */
  label: string;
  /** Value rendered in the body type. */
  children: ReactNode;
}

/**
 * One row of a description list: a 120px mono label, a 16px gap, and the
 * value, separated from the next row by a hairline. Place these inside a `<dl>`.
 */
export function DataRow({ label, children }: DataRowProps) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 border-b border-solid border-hairline py-3 last:border-b-0">
      <dt className="t-label text-muted">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere] t-body text-ink">{children}</dd>
    </div>
  );
}
