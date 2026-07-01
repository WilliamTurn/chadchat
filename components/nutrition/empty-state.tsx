"use client";

import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * NUT-5 — the true empty state for the Calorie Tracker (no meals ever logged).
 * Replaces a line of plain grey text with an illustration-in-a-soft-circle, a
 * Chad-voice headline + subline, and a CTA that scrolls to and focuses the log
 * form above. Matches the kitchen empty state (NUT-6).
 */
export function NutritionEmptyState() {
  function focusLogForm() {
    const section = document.getElementById("log-meal");
    if (!section) {
      return;
    }
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    // Drop keyboard focus into the form so the CTA actually "focuses the log
    // form", not just scrolls to it.
    const focusable = section.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus({ preventScroll: true });
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-blood/10">
        <UtensilsCrossed className="size-7 text-blood" />
      </div>
      <h3 className="font-semibold text-lg">Nothing logged yet</h3>
      <p className="max-w-xs text-muted-foreground text-sm">
        Log your first meal — by photo or by hand — and Chad grades it, counts
        your macros, and keeps your day honest. He can't coach what he can't
        see.
      </p>
      <Button className="mt-1" onClick={focusLogForm} type="button">
        Log your first meal
      </Button>
    </div>
  );
}
