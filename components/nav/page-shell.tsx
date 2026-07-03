import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The single, shared page frame for every standalone (non-chat) page (DS-12).
 *
 * ONE content width, everywhere (DSH-49). Before this, pages hand-set their
 * own `<main>` width (and later a "narrow" opt-out), so the content column
 * visibly jumped width as you navigated — /hydration rendered narrower than
 * /sleep, a goal document narrower than a plan document. Every page now gets
 * the same max-w-5xl (≈1024px) column and the same responsive gutters; a page
 * that looks stretched at this width fixes its internal layout (grid columns,
 * capped control widths), never the frame.
 *
 * Pages render their own `<StandaloneHeader>` (and any Toaster) as the first
 * children, exactly as before — this only owns the outer frame.
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
