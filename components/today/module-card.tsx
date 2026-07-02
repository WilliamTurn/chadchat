import Link from "next/link";
import type { ReactNode } from "react";
import { type ChipTone, IconChip } from "@/components/today/icon-chip";
import { cn } from "@/lib/utils";

/**
 * The /today card grammar (DSH-32 + R2-7): every dashboard module follows the
 * same three-slot layout so the page scans consistently:
 *
 *   [IconChip TITLE]                      [View all →]   ← ModuleHeader
 *   …module content…
 *   [status line, full width]
 *   [Ask Chad]              [config] [primary action]    ← ModuleFooter
 *
 * - The header's right slot only ever holds the quiet view/history link, and
 *   only when the module has a destination page (omit it otherwise).
 * - Ask Chad has ONE fixed home (R2-7): anchored alone on the left edge of
 *   every footer, via the `askChad` slot. The rest of the controls (config
 *   editors, undo, the single primary action) stay a right-aligned cluster in
 *   `children`, so the eye finds Ask Chad in the identical spot on every
 *   card no matter how many other controls the card carries. Modules whose
 *   logging controls ARE the content (the hydration quick-adds) keep them in
 *   the body.
 * - The optional status line sits on its own row above the controls so it can
 *   never push Ask Chad out of position.
 * - ModuleCard is a flex column and the footer is `mt-auto`, so footers line
 *   up across equal-height grid rows.
 */
export function ModuleCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6",
        className
      )}
    >
      {children}
    </section>
  );
}

export function ModuleHeader({
  icon,
  tone,
  title,
  viewHref,
  viewLabel = "View all",
}: {
  icon: ReactNode;
  tone: ChipTone;
  title: string;
  /** The module's history/detail page; the link renders only when set. */
  viewHref?: string;
  viewLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-2.5 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        <IconChip tone={tone}>{icon}</IconChip>
        <span className="truncate">{title}</span>
      </h2>
      {viewHref && (
        <Link
          className="whitespace-nowrap text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
          href={viewHref}
        >
          {viewLabel} →
        </Link>
      )}
    </div>
  );
}

export function ModuleFooter({
  status,
  askChad,
  children,
}: {
  /** Optional muted context line, on its own row above the controls. */
  status?: ReactNode;
  /** The card's Ask Chad button — always anchored on the left edge (R2-7). */
  askChad?: ReactNode;
  /** The right-aligned cluster: config controls, then the primary action. */
  children?: ReactNode;
}) {
  return (
    <div className="mt-auto flex flex-col gap-2 pt-4">
      {status ? (
        <div className="min-w-0 text-muted-foreground text-sm">{status}</div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="shrink-0">{askChad}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}
