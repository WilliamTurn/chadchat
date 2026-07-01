import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The single, shared page frame for every standalone (non-chat) page (DS-12).
 *
 * Before this, each page hand-set its own `<main>` width — /today at max-w-4xl,
 * most feature pages at max-w-3xl, /account at max-w-xl — so the content column
 * visibly jumped width as you navigated, and on wide monitors everything sat in
 * a narrow strip with huge empty side margins. This standardizes one content
 * width + one set of responsive gutters, so the frame is consistent everywhere
 * and the dense dashboards get room to breathe.
 *
 * `size`:
 * - "default" (max-w-5xl ≈ 1024px) — the standard for every page.
 * - "wide"    (max-w-6xl ≈ 1152px) — opt-in for an exceptionally dense page that
 *   genuinely needs the extra columns. Use sparingly; the point is consistency.
 *
 * Pages render their own `<StandaloneHeader>` (and any Toaster) as the first
 * children, exactly as before — this only owns the outer frame.
 */
export function PageShell({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide";
}) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col px-4 py-10 sm:px-6 sm:py-12",
        size === "wide" ? "max-w-6xl" : "max-w-5xl",
        className
      )}
    >
      {children}
    </main>
  );
}
