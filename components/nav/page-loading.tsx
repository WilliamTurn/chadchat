import { PageShell } from "@/components/nav/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared route-transition fallback for the standalone pages (DS-15). Every
 * app/<page>/loading.tsx renders this so a nav click is acknowledged the
 * instant it lands: the real shell (sidebar + top bar, both rendered by
 * PageShell) paints immediately and stays clickable while the server page
 * streams in behind a neutral title + card skeleton. Generic on purpose: one
 * shape for every page beats thirteen bespoke skeletons that drift out of
 * sync with their pages.
 */
export function PageLoading() {
  return (
    <PageShell>
      <div className="mb-8 flex flex-col gap-2.5">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </PageShell>
  );
}
