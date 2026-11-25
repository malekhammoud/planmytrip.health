import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CLERK_APPEARANCE } from "@/lib/clerkAppearance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account - PlanMyTrip.health",
  description: "Manage your profile, plan, payment method, and invoices.",
};

/** Account and billing management. Clerk owns the profile, plan, and invoices. */
export default async function AccountPage() {
  const { userId } = await auth();
  if (userId === null) redirect("/sign-in");

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-container flex-1 pt-12 md:pt-20">
        <p className="t-label text-muted">Account</p>
        <h1 className="t-display measure mt-3">Your account.</h1>
        <p className="t-body measure mt-5 text-muted">
          Manage your profile, plan, and billing here. Your saved trips have their own page.
        </p>
        <div className="mt-8">
          <Suspense
            fallback={<p className="t-small text-muted">Loading your account.</p>}
          >
            <UserProfile
              routing="path"
              path="/account"
              appearance={CLERK_APPEARANCE}
            />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
