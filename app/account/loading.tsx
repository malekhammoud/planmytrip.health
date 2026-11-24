import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Skeleton } from "@/components/ui";

/** Designed loading state for account and billing. */
export default function AccountLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="page-container flex-1 pt-12 md:pt-20">
        <Skeleton height={16} width={90} />
        <div className="mt-4">
          <Skeleton height={44} width="38%" />
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <Skeleton height={16} width="60%" />
          <Skeleton height={16} width="44%" />
        </div>
        <div className="mt-10">
          <Skeleton height={280} width="100%" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
