"use client";

import { ChefHat, ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The collapsible "Build a new plan" panel under an active meal plan. It was a
 * bare <details> with the marker hidden: once opened there was no visible way
 * to close it again (owner report, s181). Standard disclosure-panel pattern
 * instead: a full-width header button with a rotating chevron, plus an
 * explicit Cancel at the bottom of the form, where a member who scrolled
 * through it and changed their mind actually is.
 */
export function NewPlanSection({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5">
      <button
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 font-medium text-sm"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="flex items-center gap-2">
          <ChefHat className="size-4 text-blood" />
          Build a new plan
        </span>
        <ChevronDown
          aria-hidden
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="mt-3">
          <p className="mb-4 text-muted-foreground text-sm">
            Generating a new plan replaces the one above. Your current plan is
            archived, not deleted.
          </p>
          {children}
          <Button
            className="mt-3 w-full text-muted-foreground"
            onClick={() => setOpen(false)}
            type="button"
            variant="ghost"
          >
            Cancel, keep my current plan
          </Button>
        </div>
      )}
    </section>
  );
}
