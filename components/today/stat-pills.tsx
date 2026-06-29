"use client";

/**
 * The /today hero stat band: three large stat pills (today's calories, weight
 * change since start, active days this week) under the greeting. Each pill has a
 * domain-colored icon chip + soft glow so the dashboard reads as a cockpit, not
 * a form — the Whoop/Oura pattern, kept restrained on Chad's blood-on-ink brand.
 *
 * Every value here is real data the page already computes — no invented
 * "readiness" or "calories burned" metrics we don't track.
 */

import { Activity, Flame, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { CountUp } from "@/components/dashboard/count-up";
import { cn } from "@/lib/utils";

type Tone = "amber" | "violet" | "emerald";

const TONE: Record<Tone, { chip: string; glow: string; icon: string }> = {
  amber: {
    chip: "bg-[oklch(0.769_0.188_70.08)]/12 text-[oklch(0.769_0.188_70.08)]",
    glow: "bg-[oklch(0.769_0.188_70.08)]/15",
    icon: "text-[oklch(0.769_0.188_70.08)]",
  },
  violet: {
    chip: "bg-[oklch(0.627_0.265_303.9)]/12 text-[oklch(0.627_0.265_303.9)]",
    glow: "bg-[oklch(0.627_0.265_303.9)]/15",
    icon: "text-[oklch(0.627_0.265_303.9)]",
  },
  emerald: {
    chip: "bg-[oklch(0.696_0.17_162.48)]/12 text-[oklch(0.696_0.17_162.48)]",
    glow: "bg-[oklch(0.696_0.17_162.48)]/15",
    icon: "text-[oklch(0.696_0.17_162.48)]",
  },
};

function StatPill({
  icon,
  tone,
  value,
  label,
  sub,
}: {
  icon: ReactNode;
  tone: Tone;
  value: string;
  label: string;
  sub?: string;
}) {
  const t = TONE[tone];
  return (
    <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-background/40 p-4">
      <div
        aria-hidden
        className={cn(
          "-right-6 -top-6 pointer-events-none absolute size-20 rounded-full blur-2xl",
          t.glow
        )}
      />
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            t.chip
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-display font-bold text-xl leading-none tabular-nums">
            <CountUp value={value} />
          </div>
          <div className="mt-1 truncate text-muted-foreground text-xs">
            {label}
            {sub && <span className="ml-1 text-muted-foreground/70">{sub}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatPills({
  calories,
  calorieTarget,
  weightChange,
  weightUnit,
  activeThisWeek,
}: {
  calories: number;
  calorieTarget: number | null;
  weightChange: number | null;
  weightUnit: "lb" | "kg";
  activeThisWeek: number;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <StatPill
        icon={<Flame className="size-5" strokeWidth={2.5} />}
        label="Eaten today"
        sub={calorieTarget ? `/ ${calorieTarget.toLocaleString()}` : undefined}
        tone="amber"
        value={`${calories.toLocaleString()} cal`}
      />
      <StatPill
        icon={
          (weightChange ?? 0) <= 0 ? (
            <TrendingDown className="size-5" strokeWidth={2.5} />
          ) : (
            <TrendingUp className="size-5" strokeWidth={2.5} />
          )
        }
        label="Since start"
        tone="violet"
        value={
          weightChange == null
            ? "—"
            : `${weightChange > 0 ? "+" : ""}${weightChange} ${weightUnit}`
        }
      />
      <StatPill
        icon={<Activity className="size-5" strokeWidth={2.5} />}
        label="Active this week"
        tone="emerald"
        value={`${activeThisWeek} / 7`}
      />
    </div>
  );
}
