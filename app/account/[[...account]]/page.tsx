import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CLERK_APPEARANCE } from "@/lib/clerkAppearance";
import { signInHref } from "@/lib/redirects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account - PlanMyTrip.health",
  description: "Manage your profile, plan, payment method, and invoices.",
};

/** Account and billing management. Clerk owns the profile, plan, and invoices. */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ account?: string[] }>;
}) {
  const segments = (await params).account ?? [];
  const returnPath = `/account${segments
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .map((segment) => `/${encodeURIComponent(segment)}`)
    .join("")}`;
  const { userId } = await auth();
  if (userId === null) redirect(signInHref(returnPath));

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

        <section
          aria-labelledby="delete-account-heading"
          className="mt-16 border-t border-hairline pt-8"
        >
          <h2 id="delete-account-heading" className="t-label text-muted">
            Delete account
          </h2>
          <div className="mt-3">
            <DeleteAccountButton />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
