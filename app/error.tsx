"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- error boundaries use a full navigation so a stale client router cannot trap the reader. */

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { reportClientError } from "@/lib/ops/client";

/** Root failure state for PlanMyTrip.health. */
export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "app.error");
  }, [error]);
  const retry = unstable_retry ?? reset ?? (() => window.location.reload());
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-16 text-center">
      <p className="t-label text-muted">PlanMyTrip.health</p>
      <h1 className="t-title mt-3">This page did not open.</h1>
      <p className="t-small mt-3 max-w-md leading-relaxed text-muted">
        Something failed on our side. Try again, or return to the planner. If you were
        saving a trip, check your saved trips before retrying.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <a href="/" className="t-small inline-flex min-h-11 items-center text-accent hover:underline">
          Return to the planner
        </a>
      </div>
      {error.digest ? <p className="t-small mt-4 text-muted">Reference {error.digest}</p> : null}
    </main>
  );
}
