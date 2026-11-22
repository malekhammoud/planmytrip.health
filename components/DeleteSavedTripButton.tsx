"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type DeleteState = "idle" | "deleting" | "error";

/** Deletes one owned saved trip and returns to the list. */
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        onClick={() => {
          void handleDelete();
        }}
        loading={state === "deleting"}
      >
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
