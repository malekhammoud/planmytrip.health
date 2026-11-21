"use client";

import { useRef } from "react";
import { nextTabIndex } from "./tabOrder";

/** One tab in a {@link TabBar}. */
export interface TabItem {
  /** Stable id used in the tab and panel DOM ids. */
  id: string;
  /** Visible tab label. */
  label: string;
  /** Optional small count or status beside the label. */
  badge?: string;
}

/** Props for {@link TabBar}. */
export interface TabBarProps {
  /** Tabs in display order. */
  items: readonly TabItem[];
  /** Id of the selected tab. */
  active: string;
  /** Called with the next tab id. */
  onChange: (id: string) => void;
  /** Accessible name for the tab list. */
  label: string;
  /** Prefix shared with the controlled panels. */
  idPrefix: string;
}

/**
 * Ruled workspace tabs: a hairline baseline, a 2px accent underline for the active tab,
 * roving focus, and arrow, Home, and End keyboard support. Never a pill.
 */
export function TabBar({
  items,
  active,
  onChange,
  label,
  idPrefix,
}: TabBarProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function move(index: number): void {
    const item = items[index];
    if (item === undefined) return;
    onChange(item.id);
    refs.current[index]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-6 overflow-x-auto border-b border-hairline"
    >
      {items.map((item, index) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              const next = nextTabIndex(index, event.key, items.length);
              if (next === index) return;
              event.preventDefault();
              move(next);
            }}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 t-button transition-colors duration-150 ${
              selected
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {item.label}
            {item.badge ? (
              <span className="t-data-sm text-muted">{item.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
