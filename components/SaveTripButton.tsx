/* eslint-disable @next/next/no-html-link-for-pages -- account, billing, and saved-trip links deliberately use a full navigation so a stale client router cannot trap the click. */
"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import type { AgentTripPlan, TripConfig } from "@/lib/agent/agentTypes";

type SaveState = "idle" | "saving" | "saved" | "limit" | "error";

/** Props for {@link SaveTripButton}. */
export interface SaveTripButtonProps {
  trip: TripConfig;
  runId: string;
  plan: AgentTripPlan | null;
}

/**
 * Saves the finished plan as an account-owned snapshot. The live plan is the only
 * source; the server revalidates both the trip and the plan before writing.
 */
export function SaveTripButton({ trip, runId, plan }: SaveTripButtonProps) {
  const [state, setState] = useState<SaveState>("idle");
  const [limitMessage, setLimitMessage] = useState(
    "The Free Preview includes one saved trip. Upgrade to save more.",
  );
  const unavailable = plan === null || plan.mock === true;

  async function handleSave(): Promise<void> {
    if (plan === null || plan.mock === true) return;
    setState("saving");
    try {
      const response = await fetch("/api/saved-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, trip, plan }),
      });
      if (response.status === 403) {
        const body: unknown = await response.json().catch(() => null);
        if (
          typeof body === "object" &&
          body !== null &&
          !Array.isArray(body) &&
          (body as Record<string, unknown>).code === "saved_trip_limit"
        ) {
          const message = (body as Record<string, unknown>).error;
          if (typeof message === "string") setLimitMessage(message);
          setState("limit");
          return;
        }
      }
      if (!response.ok) throw new Error("save failed");
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => {
          void handleSave();
        }}
        loading={state === "saving"}
        disabled={unavailable}
        leadingIcon={state === "saved" ? Check : undefined}
      >
        {state === "saved" ? "Saved" : "Save trip"}
      </Button>
      {state === "saved" ? (
        <a
          href="/trips"
          className="t-small inline-flex min-h-11 items-center text-accent hover:underline"
        >
          View saved trips
        </a>
      ) : null}
      {plan?.mock === true ? (
        <span className="t-small text-muted">Sample plans cannot be saved.</span>
      ) : null}
      {state === "limit" ? (
        <span className="t-small text-caution">
          {limitMessage}{" "}
          <a href="/pricing" className="text-accent hover:underline">
            See plans
          </a>
          .
        </span>
      ) : null}
      {state === "error" ? (
        <span className="t-small text-caution">Trip not saved. Try again.</span>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "saved" ? "Trip saved." : ""}
        {state === "limit" ? "Saved trip limit reached." : ""}
        {state === "error" ? "Trip not saved." : ""}
      </span>
    </div>
  );
}
