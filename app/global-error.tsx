"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- error boundaries use a full navigation so a stale client router cannot trap the reader. */

import "./globals.css";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { reportClientError } from "@/lib/ops/client";

/** Last-resort boundary when the root layout itself fails. */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "global.error");
  }, [error]);
  const retry = unstable_retry ?? (() => window.location.reload());
  return (
    <html lang="en">
      <body className="bg-paper text-ink">
        <main className="flex min-h-screen flex-col items-center justify-center px-5 py-16 text-center">
          <p className="t-label text-muted">PlanMyTrip.health</p>
          <h1 className="t-title mt-3">This page did not open.</h1>
          <p className="t-small mt-3 max-w-md leading-relaxed text-muted">
            The page failed to load, and nothing was submitted. Try again, or open the
            planner fresh.
          </p>
          <Button className="mt-5" onClick={() => retry()}>
            Try again
          </Button>
          <a href="/" className="t-small mt-3 inline-flex min-h-11 items-center text-accent hover:underline">
            Open the planner
          </a>
          {error.digest ? <p className="t-small mt-4 text-muted">Reference {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
