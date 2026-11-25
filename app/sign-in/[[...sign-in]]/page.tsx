import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoLink } from "@/components/Logo";
import { DestinationAd } from "@/components/ads/DestinationAd";
import { safeReturnPath } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Sign in - PlanMyTrip.health",
  description: "Sign in to plan a trip and keep your saved trips in one place.",
};

/**
 * The in-app sign-in screen. The planner requires an account so saved trips have a
 * stable owner; the prebuilt Clerk form keeps password and provider handling out of the
 * product's own code.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const requested = (await searchParams).redirect_url;
  const returnPath =
    safeReturnPath(Array.isArray(requested) ? requested[0] : requested) ?? "/";
  return (
    <>
    <DestinationAd variant="bar" intent="upgrade" placement="sign-in" />
    <main className="page-container flex min-h-dvh flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md">
        <LogoLink />
        <p className="t-label mt-10 text-muted">Account</p>
        <h1 className="t-title mt-2">Plan a trip that fits your health.</h1>
        <p className="t-body mt-3 text-muted">
          Your account keeps saved trips and plans, so you can pick up where you left off.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="t-small text-muted">Loading sign-in.</p>}>
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl={returnPath}
              signUpFallbackRedirectUrl={returnPath}
            />
          </Suspense>
        </div>
        <p className="t-small measure mt-8 text-muted">
          Planning aid only. Not medical advice. Check the details before you book.
        </p>
      </div>
    </main>
    </>
  );
}
