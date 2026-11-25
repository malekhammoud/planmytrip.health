"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { WorkerId } from "@/lib/swarmTypes";

interface Panel {
  path: string;
  heading: string;
  lines: readonly string[];
}

const PANELS: Record<WorkerId, readonly Panel[]> = {
  advisory: [
    {
      path: "/travelling/advisories/lisbon",
      heading: "Travel advice and advisories",
      lines: [
        "Exercise a high degree of caution in the destination.",
        "Review the health notices before departure.",
        "Seasonal heat and air quality can affect outdoor plans.",
      ],
    },
    {
      path: "/travelling/advisories/lisbon/health",
      heading: "Health notices",
      lines: [
        "Measles vaccination is recommended for some travellers.",
        "Check local emergency numbers on arrival.",
        "Confirm the nearest hospital or urgent care after landing.",
      ],
    },
    {
      path: "/travelling/advisories/lisbon/safety",
      heading: "Safety and security",
      lines: [
        "Petty crime is common in crowded areas.",
        "Keep bags closed on public transport.",
        "Avoid unlit streets after dark.",
      ],
    },
    {
      path: "/travelling/advisories/lisbon/entry",
      heading: "Entry requirements",
      lines: [
        "A valid passport is required.",
        "Check the current visa rules before booking.",
        "Keep a copy of the passport in a separate bag.",
      ],
    },
  ],
};

/** Dev-only fake browser viewport; production rewrites this route to 404. */
export function MockBrowser({ worker }: { worker: WorkerId }) {
  const panels = PANELS[worker];
  const reduced = useReducedMotion();
  const [panelIndex, setPanelIndex] = useState(0);
  const [cursor, setCursor] = useState({ left: 28, top: 42 });
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const advance = (): void => {
      if (cancelled) return;
      setPanelIndex((index) => (index + 1) % panels.length);
      // 4-6s per panel, varied by the panel index so it never looks like a metronome.
      timer = setTimeout(advance, 4000 + ((panelIndex * 937) % 2000));
    };
    timer = setTimeout(advance, 4600);
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [panelIndex, panels.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCursor((current) => {
        const left = 12 + ((current.left * 7 + 23) % 70);
        const top = 18 + ((current.top * 5 + 17) % 60);
        return { left, top };
      });
      setClicks((value) => value + 1);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const panel = panels[panelIndex] ?? panels[0];
  const cursorStyle = {
    left: `${cursor.left}%`,
    top: `${cursor.top}%`,
    transition: reduced ? "none" : "left 900ms var(--ease), top 900ms var(--ease)",
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-sunken px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <p className="t-label text-muted">Mock browser</p>
        <div className="mt-3 overflow-hidden rounded-frame border border-hairline-strong bg-surface">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-4 py-2">
            <span className="flex gap-1" aria-hidden="true">
              <span className="block h-2 w-2 border border-solid border-hairline-strong" />
              <span className="block h-2 w-2 border border-solid border-hairline-strong" />
              <span className="block h-2 w-2 border border-solid border-hairline-strong" />
            </span>
            <p className="t-data-sm min-w-0 flex-1 truncate text-muted">
              preview.mock {panel?.path}
            </p>
            <p className="t-label text-caution">Mock browser</p>
          </div>

          <div className="relative min-h-96 p-5 md:p-8">
            <div className="max-w-xl">
              <p className="t-label text-muted">
                {worker} · panel {panelIndex + 1} of {panels.length}
              </p>
              <h1 className="t-title mt-2">{panel?.heading}</h1>
              <ul className="mt-6 flex flex-col gap-3">
                {panel?.lines.map((line) => (
                  <li key={line} className="t-body text-ink">
                    {line}
                  </li>
                ))}
              </ul>
              <p className="t-data-sm mt-8 text-muted">
                Click {clicks} · static mock content, no network
              </p>
            </div>
            <span
              aria-hidden="true"
              // The fake cursor is the one round mark in this dev-only viewport.
              className="pointer-events-none absolute block h-3 w-3 rounded-full bg-ink" // design-guard-ignore
              style={cursorStyle}
            />
          </div>
        </div>
        <p className="t-small mt-4 text-muted">
          This view exists only in development. It never loads a real site.
        </p>
      </div>
    </div>
  );
}
