import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Create an account - PlanMyTrip.health",
};

/**
 * The in-app sign-up screen. A successful sign-up returns to the planner, where the
 * newly created session can build and save a trip.
 */
export default function SignUpPage() {
  return (
    <main className="page-container flex min-h-dvh flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="t-wordmark text-ink" aria-label="PlanMyTrip.health home">
          PlanMyTrip
          <span className="t-data text-accent">.health</span>
        </Link>
        <p className="t-label mt-10 text-muted">Account</p>
        <h1 className="t-title mt-2">Create an account</h1>
        <p className="t-body mt-3 text-muted">
          An account lets you keep the trips you plan and return to them later.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="t-small text-muted">Loading sign-up.</p>}>
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/"
            />
          </Suspense>
        </div>
        <p className="t-small measure mt-8 text-muted">
          Planning aid only. Not medical advice. Confirm every limit with your clinician
          and insurer before you travel.
        </p>
      </div>
    </main>
  );
}
