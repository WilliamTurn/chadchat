"use client";

/**
 * ACTION CLUSTER (FIX-16, Phase 2 / P2-B). The one action grammar for every
 * dashboard panel footer, published for P2-D overlays to adopt (briefing
 * cross-session log, 2026-07-12).
 *
 * The contract it enforces (lib/contracts/panels.ts + density-hierarchy.md):
 *   - At most ONE primary action. `primary` is a single object, not an array,
 *     so a second primary cannot typecheck.
 *   - Quiet actions stay quiet: `secondary` renders ghost buttons, capped at
 *     two; anything more belongs in `overflow` or on the detail page.
 *   - Settings/config live in `overflow` (the "More options" menu), never as
 *     a visible peer of the primary action.
 *   - Destructive actions NEVER appear on a dashboard panel (owner law), so
 *     this API has no destructive variant. Destructive flows live on detail
 *     pages behind the P2-D confirm-or-undo platform.
 *   - Labels are instantly clear verb+object copy; dev builds run the
 *     lib/contracts/copy.ts tripwires against every label.
 *
 * Layout: the cluster is the right-aligned half of ModuleFooter; Ask Chad
 * keeps its fixed footer-left home (R2-7) and is NOT part of this cluster.
 */

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { findBannedCopy } from "@/lib/contracts/copy";

export type PanelAction = {
  /** Verb + object, instantly clear ("Log meal", "Start a workout"). */
  label: string;
  icon?: ReactNode;
  /** Navigation form; renders a Link. */
  href?: string;
  /** Handler form; ignored when `href` is set. */
  onClick?: () => void;
  disabled?: boolean;
};

export type OverflowAction = {
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
};

function warnBannedCopy(context: string, label: string) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  for (const v of findBannedCopy(label)) {
    console.error(
      `ActionCluster ${context} label "${label}" violates copy contract [${v.ruleId}]: ${v.reason}`
    );
  }
}

/** 44px touch targets at phone widths (owner accessibility law); the
 *  compact 32px visual returns once a pointer is the likely input. */
const TOUCH_TARGET = "min-h-11 sm:min-h-8";

function ActionButton({
  action,
  variant,
}: {
  action: PanelAction;
  variant: "default" | "ghost";
}) {
  warnBannedCopy(variant === "default" ? "primary" : "secondary", action.label);
  if (action.href) {
    return (
      <Button asChild className={TOUCH_TARGET} size="sm" variant={variant}>
        <Link href={action.href}>
          {action.icon}
          {action.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      className={TOUCH_TARGET}
      disabled={action.disabled}
      onClick={action.onClick}
      size="sm"
      variant={variant}
    >
      {action.icon}
      {action.label}
    </Button>
  );
}

export function ActionCluster({
  primary,
  secondary,
  overflow,
}: {
  /** THE panel's one primary action (panel contract: 0 or 1, never 2). */
  primary?: PanelAction;
  /** Up to two quiet ghost actions; more belongs in overflow or deeper. */
  secondary?: PanelAction[];
  /** Settings/config items, behind the "More options" menu. */
  overflow?: OverflowAction[];
}) {
  const quiet = (secondary ?? []).slice(0, 2);
  if (
    process.env.NODE_ENV !== "production" &&
    (secondary?.length ?? 0) > 2
  ) {
    console.error(
      "ActionCluster: more than 2 secondary actions; extras were dropped. Move them to overflow or the detail page (density-hierarchy.md action budget)."
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {overflow && overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="More options"
              className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"
              size="icon-sm"
              variant="ghost"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {overflow.map((item) => {
              warnBannedCopy("overflow", item.label);
              return item.href ? (
                <DropdownMenuItem
                  asChild
                  className={TOUCH_TARGET}
                  key={item.label}
                >
                  <Link href={item.href}>
                    {item.icon}
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className={TOUCH_TARGET}
                  key={item.label}
                  onClick={item.onClick}
                >
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {quiet.map((action) => (
        <ActionButton action={action} key={action.label} variant="ghost" />
      ))}
      {primary && <ActionButton action={primary} variant="default" />}
    </div>
  );
}
