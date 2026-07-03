"use client";

import { Sparkles } from "lucide-react";
import { startPlanChange } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import type { PlanStatusSummary } from "@/lib/subscription";

function trialLabel(days: number): string {
  if (days <= 0) {
    return "Last day of your free trial";
  }
  if (days === 1) {
    return "1 day left in your free trial";
  }
  return `${days} days left in your free trial`;
}

/**
 * The small account-status block above the user menu: a trial countdown while
 * trialing, and an "Upgrade to Pro" action for Basic members. Pro members (and
 * anyone with nothing to nudge) render nothing. Hidden when the sidebar is
 * collapsed to icons.
 */
export function SidebarPlanStatus({ plan }: { plan: PlanStatusSummary }) {
  const isTrialing = plan.status === "trialing";
  const canUpgrade = plan.tier === "basic";
  // Pro/Elite used to get "Calorie Tracker" / "Progress" quick links here, from
  // the lean-sidebar era when the nav didn't carry them. NAV-31 put the full
  // feature inventory in the nav list above, so the footer copies were exact
  // duplicates (two identical entries visible at once on the mobile drawer).

  if (!(isTrialing || canUpgrade)) {
    return null;
  }

  return (
    <div className="mb-1 flex flex-col gap-2 px-1 group-data-[collapsible=icon]:hidden">
      {isTrialing && plan.trialDaysLeft !== null && (
        <p className="px-1 text-[12px] text-sidebar-foreground/60">
          {trialLabel(plan.trialDaysLeft)}
        </p>
      )}
      {canUpgrade && (
        // A form with the server action keeps the Stripe redirect working
        // cleanly (same pattern as "Manage billing" on the account page).
        <form action={startPlanChange}>
          <Button className="h-8 w-full gap-1.5 text-[13px]" size="sm" type="submit">
            <Sparkles className="size-3.5" />
            Upgrade to Pro
          </Button>
        </form>
      )}
    </div>
  );
}
