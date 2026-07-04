import { Suspense } from "react";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared route-transition fallback for the standalone pages (DS-15). Every
 * app/<page>/loading.tsx renders this so a nav click is acknowledged the
 * instant it lands: the real header paints immediately (and stays clickable,
 * with the active pill already on the destination) while the server page
 * streams in behind a neutral title + card skeleton. Generic on purpose — one
 * shape for every page beats thirteen bespoke skeletons that drift out of
 * sync with their pages.
 *
 * The header carries its own Suspense boundary: usePathname is request-time
 * data during prerendering, and on dynamic-param routes (/goals/[id]) the
 * static shell can't know the path — without the boundary the whole build
 * fails with "uncached data accessed outside <Suspense>".
 */
export function PageLoading() {
  return (
    <PageShell>
      <Suspense
        fallback={
          <div className="mb-8 border-border border-b pb-3">
            <Skeleton className="h-9 w-full" />
          </div>
        }
      >
        <StandaloneHeader />
      </Suspense>
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
