import Link from "next/link";
import type { ReactNode } from "react";
import { type ChipTone, IconChip } from "@/components/today/icon-chip";
import { cn } from "@/lib/utils";

/**
 * The /today card grammar (DSH-32) — every dashboard module follows the same
 * three-slot layout so the page scans consistently:
 *
 *   [IconChip TITLE]                      [View all →]   ← ModuleHeader
 *   …module content…
 *   [status line]        [Ask Chad] [config] [primary]   ← ModuleFooter
 *
 * - The header's right slot only ever holds the quiet view/history link, and
 *   only when the module has a destination page (omit it otherwise).
 * - Every interactive control lives in the footer, always in the same order:
 *   Ask Chad, then any config control (goal/target editors, undo), then the
 *   single primary action, right-aligned. Modules whose logging controls ARE
 *   the content (the hydration quick-adds) keep them in the body and use the
 *   footer for Ask Chad + config only.
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
  children,
}: {
  /** Optional muted context line, kept left of the action cluster. */
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4">
      <div className="min-w-0 text-muted-foreground text-sm">{status}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}
