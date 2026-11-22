"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import type { AgentTripPlan, TripConfig } from "@/lib/agent/agentTypes";

type SaveState = "idle" | "saving" | "saved" | "error";

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
        <Link
          href="/trips"
          className="t-small inline-flex min-h-11 items-center text-accent hover:underline"
        >
          View saved trips
        </Link>
      ) : null}
      {plan?.mock === true ? (
        <span className="t-small text-muted">Sample plans cannot be saved.</span>
      ) : null}
      {state === "error" ? (
        <span className="t-small text-caution">Trip not saved. Try again.</span>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "saved" ? "Trip saved." : ""}
        {state === "error" ? "Trip not saved." : ""}
      </span>
    </div>
  );
}
