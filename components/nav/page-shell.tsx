import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The single, shared page frame for every standalone (non-chat) page (DS-12).
 *
 * Owner law (LAY-1, s177/s178): desktop gets FULL pages, like the rest of the
 * web. The standard frame is wide (max-w-[1500px] with the shared gutters) and
 * each page fills it with a real desktop layout: dashboard grids, form +
 * summary side-by-sides, sidebars. Text blocks and inputs may cap their own
 * width WITHIN that layout; the page itself never renders as one narrow
 * centered column. Tablet and phone keep their correct responsive layouts.
 *
 * Transition note: pages converted to a full desktop layout pass
 * `className="max-w-[1500px]"`; pages the layout sweep has not reached yet
 * still get the old max-w-5xl default so their single-column content does not
 * strand on a wide frame. When the sweep finishes, the wide frame becomes the
 * default here.
 *
 * Pages render their own `<StandaloneHeader>` (and any Toaster) as the first
 * children, exactly as before; this only owns the outer frame.
 */
export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-10 sm:px-6 sm:py-12",
        className
      )}
    >
      {children}
    </main>
  );
}
