/**
 * Mobile workspace dock: five section anchors with live badges.
 *
 * Inputs: whether the planner and verification streams are running.
 * Outputs: a fixed bottom bar below 1024px that jumps to the five mounted workspace
 * sections. Each item is a real anchor, so the page keeps one scroll and no panel is
 * unmounted by navigation.
 * Invariants: 44px targets, no horizontal overflow at 375px, badges appear only while
 * the matching stream is live.
 */

"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** One dock target. */
interface DockItem {
  id: string;
  label: string;
  live?: boolean;
}

/** Props for {@link CommandDock}. */
export interface CommandDockProps {
  plannerLive: boolean;
  checksLive: boolean;
}

/** The fixed section dock for narrow viewports. */
export function CommandDock({ plannerLive, checksLive }: CommandDockProps) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string): void => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (target === null) return;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setActive(id);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(null), 900);
  };

  const items: DockItem[] = [
    { id: "route-stage", label: "Route" },
    { id: "planning-team", label: "Team", live: plannerLive },
    { id: "live-verification", label: "Checks", live: checksLive },
    { id: "safety-envelope", label: "Safety" },
    { id: "live-activity", label: "Activity", live: plannerLive || checksLive },
  ];

  return (
    <nav
      aria-label="Workspace sections"
      className="command-dock fixed inset-x-0 bottom-0 z-20 border-t border-solid border-hairline-strong bg-paper lg:hidden"
    >
      <ul className="page-container m-0 grid list-none grid-cols-5 gap-1 p-1">
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <a
              href={`#${item.id}`}
              onClick={(event) => jump(event, item.id)}
              aria-current={active === item.id ? "true" : undefined}
              className={`t-data-sm flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-center ${
                active === item.id ? "bg-accent-soft text-ink" : "text-muted"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1">
                {item.live === true ? (
                  <span
                    aria-hidden="true"
                    className="anim-pulse-dot block h-1.5 w-1.5 shrink-0 bg-accent"
                  />
                ) : null}
                <span className="truncate">{item.label}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
