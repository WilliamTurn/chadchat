"use client";

import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { CountUp } from "@/components/dashboard/count-up";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "good" | "bad";

/**
 * A single dashboard stat (value + label, with an optional sub-caption). Shared
 * across every dashboard chart card so weight, 1RM, nutrition and water read
 * identically. `size="lg"` is the headline stat; `tone` colors a value that's
 * moving toward the goal (good) vs away from it (bad). Pass `help` to attach a
 * small "?" icon next to the label that opens a plain-English explanation — the
 * difference between a stat a user trusts and one they ignore.
 */
export function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
  size = "md",
  help,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  size?: "md" | "lg";
  help?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          size === "lg" ? "text-2xl" : "text-xl",
          tone === "good" && "text-emerald-500",
          tone === "bad" && "text-blood"
        )}
      >
        <CountUp value={value} />
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
        <span>
          {label}
          {sub && <span className="ml-1 text-muted-foreground/70">{sub}</span>}
        </span>
        {help && <KpiHelp label={label}>{help}</KpiHelp>}
      </div>
    </div>
  );
}

/** The "?" affordance + popover that demystifies a stat in plain English.
 *  Exported for the /today hero stats + streak (HLP-1 pattern, DSH-35/R2-2). */
export function KpiHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`What does "${label}" mean?`}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:text-foreground"
          type="button"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3.5">
        <div className="mb-1 font-medium text-foreground text-sm">{label}</div>
        <div className="text-muted-foreground text-xs leading-relaxed">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
