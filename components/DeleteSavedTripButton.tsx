"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type DeleteState = "idle" | "confirm" | "deleting" | "error";

/** Deletes one owned saved trip after an explicit second confirmation. */
export function DeleteSavedTripButton({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<DeleteState>("idle");

  async function handleDelete(): Promise<void> {
    setState("deleting");
    try {
      const response = await fetch(`/api/saved-trips/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("delete failed");
      router.push("/trips");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "confirm" || state === "deleting") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="t-small text-ink">Delete this saved trip?</p>
        <Button
          variant="primary"
          onClick={() => {
            void handleDelete();
          }}
          loading={state === "deleting"}
        >
          Delete permanently
        </Button>
        <Button
          variant="ghost"
          onClick={() => setState("idle")}
          disabled={state === "deleting"}
        >
          Keep trip
        </Button>
        <span role="status" aria-live="polite" className="sr-only">
          {state === "deleting" ? "Deleting the saved trip." : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={() => setState("confirm")}>
        Delete saved trip
      </Button>
      {state === "error" ? (
        <span className="t-small text-caution">Trip not deleted. Try again.</span>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "error" ? "Saved trip not deleted." : ""}
      </span>
    </div>
  );
}
