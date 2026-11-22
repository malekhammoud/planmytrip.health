import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Skeleton } from "@/components/ui";

/** Designed loading state for the saved-trip list. */
export default function SavedTripsLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-container flex-1 pt-12 md:pt-20">
        <Skeleton height={16} width={120} />
        <div className="mt-4">
          <Skeleton height={48} width="42%" />
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <Skeleton height={16} width="70%" />
          <Skeleton height={16} width="54%" />
        </div>
        <div className="mt-10 flex flex-col gap-5">
          <Skeleton height={84} width="100%" />
          <Skeleton height={84} width="100%" />
          <Skeleton height={84} width="100%" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
