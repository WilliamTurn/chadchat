import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
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
 * - Elevation (VF-18): every card is faintly top-lit (a white gradient wash +
 *   a 1px inner top highlight, both invisible in light mode) over the shared
 *   `--shadow-card` token, and an optional `glow` tone parks a soft blurred
 *   domain accent in the top-left corner behind the icon chip. Subtle by
 *   design: the theme stays near-black; the cards just stop being flat.
 */
const GLOWS: Record<ChipTone, string> = {
  blood: "bg-blood/10",
  amber: "bg-amber-400/10",
  violet: "bg-violet-400/10",
  sky: "bg-sky-400/10",
  indigo: "bg-indigo-400/10",
  emerald: "bg-emerald-500/10",
};

export function ModuleCard({
  className,
  children,
  glow,
  ...rest
}: {
  className?: string;
  children: ReactNode;
  /** Domain accent for the card's ambient corner glow (matches its chip tone). */
  glow?: ChipTone;
} & Omit<ComponentPropsWithoutRef<"section">, "className" | "children">) {
  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card bg-gradient-to-b from-white/[0.04] via-white/[0.01] to-transparent p-6 shadow-[var(--shadow-card),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        className
      )}
      {...rest}
    >
      {glow && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-14 -left-14 size-44 rounded-full blur-3xl",
            GLOWS[glow]
          )}
        />
      )}
      {/* relative so content always paints above the positioned glow */}
      <div className="relative flex min-w-0 flex-1 flex-col">{children}</div>
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
          // Phone widths: pad the hit area to 44px+ and pull it back with
          // negative margins so the header's visual layout doesn't change
          // (FIX-19; nothing else is interactive in the header row).
          className="-mx-2 -my-3.5 flex items-center whitespace-nowrap px-2 py-3.5 text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline sm:mx-0 sm:my-0 sm:px-0 sm:py-0"
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
