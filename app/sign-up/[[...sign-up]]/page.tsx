import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoLink } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Create an account - PlanMyTrip.health",
  description: "Create an account to plan a trip and keep your saved trips in one place.",
};

/**
 * The in-app sign-up screen. A successful sign-up returns to the planner, where the
 * newly created session can build and save a trip.
 */
export default function SignUpPage() {
  return (
    <main className="page-container flex min-h-dvh flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md">
        <LogoLink />
        <p className="t-label mt-10 text-muted">Account</p>
        <h1 className="t-title mt-2">Plan a trip that fits your health.</h1>
        <p className="t-body mt-3 text-muted">
          Your account keeps saved trips and plans, so you can return to them later.
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
          Planning aid only. Not medical advice. Check the details before you book.
        </p>
      </div>
    </main>
  );
}
