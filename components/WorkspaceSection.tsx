"use client";

import { useState, type ReactNode } from "react";
import { Disclosure } from "@/components/ui";

/** Props for {@link WorkspaceSection}. */
export interface WorkspaceSectionProps {
  id: string;
  title: string;
  summary?: ReactNode;
  /** Open automatically while this surface is the live focus. */
  active: boolean;
  /** Optional action, kept outside the toggle button. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

type Choice = "auto" | "open" | "closed";

/**
 * One auto-collapsing workspace section. Active sections open; settled sections
 * collapse to their summary and can be reopened. The choice is per section, so a
 * reader can keep an archive open without pinning every other surface.
 */
export function WorkspaceSection({
  id,
  title,
  summary,
  active,
  action,
  className,
  children,
}: WorkspaceSectionProps) {
  const [choice, setChoice] = useState<Choice>("auto");
  const open = choice === "open" ? true : choice === "closed" ? false : active;

  return (
    <section
      id={id}
      aria-label={title}
      className={`workspace-section ${className ?? ""}`.trim()}
      data-active={active ? "true" : "false"}
    >
      <div className="border-t border-solid border-ink pt-3">
        <Disclosure
          title={title}
          summary={summary}
          open={open}
          onToggle={() => setChoice(open ? "closed" : "open")}
          action={action}
          level={2}
        >
          <div className="pt-4">{children}</div>
        </Disclosure>
      </div>
    </section>
  );
}
