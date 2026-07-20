import { MessageSquare, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlanStatusSummary } from "@/lib/subscription";

/**
 * THE COMPACT /home HEADER (FIX-22, DEC-05). Date eyebrow, greeting, tier
 * badge, one quiet Coach action: 72 to 88px of chrome, no decorative
 * silhouette, no stats (status belongs to the four-domain strip below), no
 * customizer (relocated to Account > Appearance per DEC-05). The MacroFactor
 * compact-header pattern from the P56-D benchmark teardown: title + uppercase
 * dateline, zero art.
 *
 * First-run exception (P1-4): a brand-new member gets the page's ONE dominant
 * action here ("Tell Chad about yourself") and every empty panel below
 * stays quiet so this is the obvious next step.
 */
export function TodayHeader({
  todayLabel,
  heroLine,
  firstRun,
  planBadge,
}: {
  /** "Sunday, July 13" on the member's own wall clock (R2-11). */
  todayLabel: string;
  /** "Welcome back, Marcus" / "Welcome to Chad". */
  heroLine: string;
  firstRun: boolean;
  planBadge: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <p className="text-eyebrow text-muted-foreground">{todayLabel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-bold font-display text-2xl tracking-tight sm:text-3xl">
            {heroLine}
          </h1>
          {planBadge}
        </div>
        {firstRun && (
          <>
            <p className="mt-2 max-w-md text-muted-foreground text-sm">
              One thing first: tell Chad about yourself. He'll set your targets
              and build your plan, and this page fills in as you log.
            </p>
            <Button asChild className="mt-4 gap-2" size="lg">
              <Link
                href={`/?prompt=${encodeURIComponent(
                  "I'm new here. Ask me what you need to know about me, then set up my targets and my plan."
                )}`}
              >
                <MessageSquare className="size-4" />
                Tell Chad about yourself
              </Link>
            </Button>
          </>
        )}
      </div>
      {/* Hidden on first-run: the one dominant CTA above owns the moment. */}
      {!firstRun && (
        <Button
          asChild
          className="min-h-11 gap-1.5 sm:min-h-9"
          size="sm"
          variant="outline"
        >
          <Link href="/">
            <MessageSquare className="size-3.5" />
            Talk to Chad
          </Link>
        </Button>
      )}
    </header>
  );
}

/** The tier badge, defined once (VF-12). */
export function PlanBadge({ plan }: { plan: PlanStatusSummary }) {
  if (plan.tier === "elite") {
    return (
      <Badge
        className="gap-1 border-foreground/30 bg-foreground/10 px-2.5 font-semibold uppercase tracking-wide"
        variant="secondary"
      >
        <Zap className="size-3" fill="currentColor" />
        Elite
      </Badge>
    );
  }
  if (plan.tier === "pro") {
    return (
      <Badge
        className="gap-1 border-blood/40 bg-blood/15 px-2.5 font-semibold text-blood uppercase tracking-wide shadow-[var(--shadow-glow-blood)]"
        variant="secondary"
      >
        <Zap className="size-3" fill="currentColor" />
        Pro
      </Badge>
    );
  }
  if (plan.status === "trialing" && plan.trialDaysLeft !== null) {
    return (
      <Badge variant="secondary">
        {plan.trialDaysLeft <= 0
          ? "Trial ends today"
          : `${plan.trialDaysLeft} days left in trial`}
      </Badge>
    );
  }
  return <Badge variant="secondary">Basic</Badge>;
}
