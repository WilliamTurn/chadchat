import { Crown, Lock } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { ChipTone } from "@/components/today/icon-chip";
import { ModuleCard, ModuleHeader } from "@/components/today/module-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { findBannedCopy } from "@/lib/contracts/copy";
import type { PanelState } from "@/lib/contracts/data-state";
import { PANEL_ROLES, type PanelRole } from "@/lib/contracts/panels";
import { cn } from "@/lib/utils";

/**
 * PANEL FRAME (FIX-14/15, Phase 2 / P2-B). The shared chassis under the seven
 * typed role components in roles.tsx. It owns everything a role must never
 * re-decide:
 *
 *   - Identity in every state: icon chip + canonical title + the named detail
 *     link render in all seven data states. Locked/loading/error swap the
 *     BODY, never the identity (data-state.ts, first-run.md).
 *   - The role height budget (FIX-15): min-height is the role's floor in
 *     every state so loading reserves real space (zero-shift law) and empty
 *     panels keep their designed compact size instead of stretching. The max
 *     is exposed as `data-height-max` for the measurement suite; composition
 *     keeps populated content inside it.
 *   - No sibling equal-height stretching (FIX-15): the card is `self-start`,
 *     so grid rows never inflate a sparse panel to match a populated sibling.
 *   - Locked is a teaser, not a hole: dashed border, lock icon, the
 *     capability in one concrete sentence, one Upgrade CTA. Never fake data,
 *     never an error tone (first-run.md section 5).
 *   - Error keeps the member's trust: no blame, logs are safe, retry offered.
 *
 * Grid spans are NOT baked into the panel (a panel must compose into any
 * grid, including the fixture matrix); composition pages place panels with
 * `panelSpanClass(role)` on the `grid-dashboard` 4/8/12 grid.
 */

export type DetailLink = { label: string; href: string };

/** Role span -> grid-dashboard columns (4 phone / 8 tablet / 12 desktop).
 *  Span follows information density, never sibling symmetry (panels.ts). */
const SPAN_CLASSES: Record<1 | 2 | 3, string> = {
  1: "col-span-4",
  2: "col-span-4 md:col-span-8",
  3: "col-span-4 md:col-span-8 xl:col-span-12",
};

export function panelSpanClass(role: PanelRole): string {
  return SPAN_CLASSES[PANEL_ROLES[role].defaultSpan];
}

/** Compact roles use 20px padding (doc 05 card variants); the rest keep
 *  ModuleCard's standard 24px. */
const COMPACT_PADDING_ROLES: readonly PanelRole[] = ["status", "summary"];

function devValidate(role: PanelRole, title: string, detailLink?: DetailLink) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  const contract = PANEL_ROLES[role];
  if (contract.detailLink === "required" && !detailLink) {
    console.error(
      `Panel "${title}" (${role}): the role contract requires a named detail link.`
    );
  }
  for (const text of [title, detailLink?.label ?? ""]) {
    for (const v of findBannedCopy(text)) {
      console.error(
        `Panel "${title}" (${role}) copy "${text}" violates [${v.ruleId}]: ${v.reason}`
      );
    }
  }
}

/**
 * The DESIGNED empty state (first-run.md): what is absent, what appears once
 * they log, a hollow identity visual, and at most ONE quiet action. This is
 * a distinct compact composition, never the populated layout with holes in
 * it, so empty panels hold their role's floor instead of squatting on dead
 * space (density-hierarchy.md collapse rule; FIX-15).
 */
export type PanelEmptySpec = {
  /** What is absent, plainly: "Not logged yet today." */
  absent: string;
  /** What appears once they log, tied to a real threshold when one exists. */
  unlock: string;
  /** The hollow designed visual (hollow strip, axis-only placeholder). */
  visual?: ReactNode;
  /** The one quiet action to start (omit when the page CTA is enough). */
  action?: ReactNode;
};

function EmptyBody({
  empty,
  compact,
}: {
  empty: PanelEmptySpec;
  /** Compact roles (status/summary) lay copy and visual side by side so a
   *  wrapped copy line stays inside the 104 to 128px cell budget. */
  compact?: boolean;
}) {
  const copy = (
    <p className="text-muted-foreground text-body-sm">
      <span className="font-medium text-foreground">{empty.absent}</span>{" "}
      {empty.unlock}
    </p>
  );
  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        {copy}
        {empty.visual && <div className="shrink-0">{empty.visual}</div>}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {copy}
      {empty.visual}
      {empty.action && <div className="pt-1">{empty.action}</div>}
    </div>
  );
}

function LockedBody({
  capability,
  cta,
}: {
  capability: string;
  cta?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-3 pt-1">
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Lock aria-hidden className="size-4" />
      </span>
      <p className="text-body text-muted-foreground">{capability}</p>
      <Button
        asChild
        className="min-h-11 gap-1.5 sm:min-h-8"
        size="sm"
        variant="outline"
      >
        <Link href="/account">
          <Crown className="size-4" />
          {cta ?? "Upgrade to Pro"}
        </Link>
      </Button>
    </div>
  );
}

function LoadingBody({ role }: { role: PanelRole }) {
  const compact = PANEL_ROLES[role].heightRange[0] <= 128;
  return (
    <div aria-busy="true" className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
      <Skeleton className="h-8 w-28" />
      {compact ? (
        <Skeleton className="h-3 w-full" />
      ) : (
        <>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
        </>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}

function ErrorBody({
  title,
  retryAction,
}: {
  title: string;
  retryAction?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-3 pt-1">
      <p className="text-body text-muted-foreground">
        We couldn't load your {title.toLowerCase()} data. Your logs are safe.
      </p>
      {retryAction}
    </div>
  );
}

export function PanelFrame({
  role,
  state,
  icon,
  tone,
  title,
  detailLink,
  lockedCapability,
  lockedCta,
  empty,
  retryAction,
  glow,
  className,
  children,
  footer,
  wrapTitle,
}: {
  role: PanelRole;
  state: PanelState;
  icon: ReactNode;
  tone: ChipTone;
  title: string;
  detailLink?: DetailLink;
  /** One concrete sentence naming what this panel does, for the locked teaser. */
  lockedCapability: string;
  /** Locked CTA label override ("Compare plans" for Elite gates); default "Upgrade to Pro". */
  lockedCta?: string;
  /** The designed compact empty state; required so it cannot be skipped. */
  empty: PanelEmptySpec;
  /** Retry affordance rendered in the error state. */
  retryAction?: ReactNode;
  glow?: ChipTone;
  className?: string;
  /** The role's slots for the data states (sparse/stale/populated). */
  children: ReactNode;
  /** Pre-composed footer (roles.tsx builds it); data states only. */
  footer?: ReactNode;
  /** Opt-in (P56-C): a long canonical title wraps at narrow widths instead
   *  of ellipsizing (a panel's own name must never truncate; mobile audit). */
  wrapTitle?: boolean;
}) {
  devValidate(role, title, detailLink);
  const contract = PANEL_ROLES[role];
  const [minHeight, maxHeight] = contract.heightRange;
  const showBody =
    state !== "locked" &&
    state !== "loading" &&
    state !== "error" &&
    state !== "empty";

  return (
    <ModuleCard
      className={cn(
        // FIX-15: no equal-height stretching; height follows content above
        // the role's floor.
        "self-start",
        COMPACT_PADDING_ROLES.includes(role) && "p-5",
        state === "locked" && "border-dashed",
        className
      )}
      data-height-max={maxHeight}
      data-height-min={minHeight}
      data-panel-role={role}
      data-panel-state={state}
      glow={state === "locked" ? undefined : glow}
      style={{ minHeight } as CSSProperties}
    >
      <ModuleHeader
        icon={icon}
        title={title}
        tone={tone}
        viewHref={detailLink?.href}
        viewLabel={detailLink?.label}
        wrapTitle={wrapTitle}
      />
      {state === "locked" && (
        <LockedBody capability={lockedCapability} cta={lockedCta} />
      )}
      {state === "loading" && <LoadingBody role={role} />}
      {state === "error" && (
        <ErrorBody retryAction={retryAction} title={title} />
      )}
      {state === "empty" && (
        <EmptyBody
          compact={COMPACT_PADDING_ROLES.includes(role)}
          empty={empty}
        />
      )}
      {showBody && children}
      {showBody && footer}
    </ModuleCard>
  );
}

/* ------------------------------------------------------------------ shared
 * body anatomy pieces the roles compose (one KPI anatomy page-wide:
 * headline value + target context, coverage line, density-hierarchy.md). */

export function PanelHeadline({
  value,
  context,
  large,
}: {
  /** The one number/statement the panel exists for. */
  value: ReactNode;
  /** Target/goal framing next to the headline ("of 2,300 kcal"). */
  context?: ReactNode;
  large?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={large ? "text-metric-lg" : "text-metric"}>{value}</span>
      {context && (
        <span className="text-muted-foreground text-body-sm">{context}</span>
      )}
    </div>
  );
}

export function PanelCoverage({ children }: { children: ReactNode }) {
  return <p className="text-meta text-muted-foreground">{children}</p>;
}
