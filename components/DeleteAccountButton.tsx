"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { Button, Callout } from "@/components/ui";

type DeleteState = "idle" | "confirm" | "deleting" | "error" | "done";

/**
 * Two-step account deletion. The server removes saved trips and billing usage, then
 * closes the Clerk account. Anonymous research captures are not linked to the account and
 * are called out explicitly before the reader confirms.
 */
export function DeleteAccountButton() {
  const { signOut } = useClerk();
  const [state, setState] = useState<DeleteState>("idle");
  const [message, setMessage] = useState("");

  async function handleDelete(): Promise<void> {
    setState("deleting");
    setMessage("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const text =
          typeof body === "object" &&
          body !== null &&
          !Array.isArray(body) &&
          typeof (body as Record<string, unknown>).error === "string"
            ? ((body as Record<string, unknown>).error as string)
            : "Your account could not be closed. Try again in a moment.";
        setMessage(text);
        setState("error");
        return;
      }
      setState("done");
      // The account is already closed; a sign-out failure must not show a false error.
      await signOut().catch(() => undefined);
      // Full reload after deleting the Clerk user; a client transition can retain a
      // stale session and loop back to the account page.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch {
      setMessage("Your account could not be closed. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="t-small text-muted">
        Account closed. Redirecting.
      </p>
    );
  }

  return (
    <div>
      <p className="t-small measure text-muted">
        Deleting your account removes your saved trips and closes your Clerk account. Your
        anonymous research capture is not linked to the account and is not removed by this
        action. You can clear this browser&apos;s site data or contact privacy@planmytrip.health
        for that capture.
      </p>
      {state === "confirm" || state === "deleting" ? (
        <div className="mt-4">
          <Callout tone="risk" title="Close the account permanently?">
            <p>
              This cannot be undone. Saved trips and the billing-usage counter are removed
              before the Clerk account is closed.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void handleDelete();
                }}
                loading={state === "deleting"}
              >
                Delete account permanently
              </Button>
              <Button
                variant="ghost"
                onClick={() => setState("idle")}
                disabled={state === "deleting"}
              >
                Keep account
              </Button>
            </div>
          </Callout>
        </div>
      ) : (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setState("confirm")}>
            Delete my account and data
          </Button>
        </div>
      )}
      {state === "error" ? (
        <Callout tone="caution" title="Account not closed">
          <p>{message}</p>
        </Callout>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "deleting" ? "Closing the account." : ""}
      </span>
    </div>
  );
}
