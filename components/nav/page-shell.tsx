import type { ReactNode } from "react";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { StandaloneShell } from "@/components/nav/standalone-shell";
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
 * The shell around the frame (both owned HERE, never by pages):
 * - the collapsible left navigation panel (LAY-2, owner order s178) via
 *   `StandaloneShell`: labeled nav down the left on desktop and tablet,
 *   collapsible to an icon rail; the collapse toggle lives on the panel.
 * - the sticky top bar (`StandaloneHeader`): full-bleed and flush with the
 *   top of the content area, current section + account menu on desktop,
 *   wordmark + hamburger sheet on phones. Pages pass their section href via
 *   `active` and never render the header themselves.
 */
export function PageShell({
  children,
  className,
  active,
}: {
  children: ReactNode;
  className?: string;
  /** The nav section this page belongs to (e.g. "/goals"), shown in the top
   *  bar and highlighted in the phone sheet. */
  active?: string;
}) {
  return (
    <StandaloneShell>
      <StandaloneHeader active={active} />
      {/* SidebarInset is the page's <main>, so this frame is a plain div. */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-12",
          className
        )}
      >
        {children}
      </div>
    </StandaloneShell>
  );
}
