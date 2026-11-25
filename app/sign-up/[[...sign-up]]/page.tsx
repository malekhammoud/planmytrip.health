import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoLink } from "@/components/Logo";
import { safeReturnPath } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Create an account - PlanMyTrip.health",
  description: "Create an account to plan a trip and keep your saved trips in one place.",
};

/**
 * The in-app sign-up screen. A successful sign-up returns to the planner, where the
 * newly created session can build and save a trip.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const requested = (await searchParams).redirect_url;
  const returnPath =
    safeReturnPath(Array.isArray(requested) ? requested[0] : requested) ?? "/";
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
              fallbackRedirectUrl={returnPath}
              signInFallbackRedirectUrl={returnPath}
            />
          </Suspense>
        </div>
        <p className="t-small measure mt-8 text-muted">
          By creating an account, you agree to our{" "}
          <a href="/terms" className="text-accent hover:underline">
            terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-accent hover:underline">
            privacy notice
          </a>
          . Planning aid only. Not medical advice.
        </p>
      </div>
    </main>
  );
}
