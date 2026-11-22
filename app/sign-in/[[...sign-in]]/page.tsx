import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Sign in - PlanMyTrip.health",
};

/**
 * The in-app sign-in screen. The planner requires an account so saved trips have a
 * stable owner; the prebuilt Clerk form keeps password and provider handling out of the
 * product's own code.
 */
export default function SignInPage() {
  return (
    <main className="page-container flex min-h-dvh flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="t-wordmark text-ink" aria-label="PlanMyTrip.health home">
          PlanMyTrip
          <span className="t-data text-accent">.health</span>
        </Link>
        <p className="t-label mt-10 text-muted">Account</p>
        <h1 className="t-title mt-2">Sign in to plan</h1>
        <p className="t-body mt-3 text-muted">
          Sign in to build a trip and keep it in your saved trips.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="t-small text-muted">Loading sign-in.</p>}>
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
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
