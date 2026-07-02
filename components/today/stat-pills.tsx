"use client";

/**
 * The /today hero stat band: three large stat pills (today's calories, weight
 * change since the first weigh-in, active days this week) under the greeting.
 * Each pill has a domain-colored icon chip + soft glow so the dashboard reads
 * as a cockpit, not a form — the Whoop/Oura pattern, kept restrained on Chad's
 * blood-on-ink brand.
 *
 * Every value here is real data the page already computes — no invented
 * "readiness" or "calories burned" metrics we don't track. Labels are plain
 * language (DSH-35): every number says what it is, and the two stats whose
 * windows confuse people (weight change, active days) carry a "?" popover
 * (HLP-1 pattern). On mobile the three pills compress to one compact row so
 * the hero stops eating the first viewport (P3-7).
 */

import { Activity, Flame, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { CountUp } from "@/components/dashboard/count-up";
import { KpiHelp } from "@/components/dashboard/kpi";
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
  help,
}: {
  icon: ReactNode;
  tone: Tone;
  value: string;
  label: string;
  sub?: string;
  help?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-background/40 p-2.5 sm:p-4">
      <div
        aria-hidden
        className={cn(
          "-right-6 -top-6 pointer-events-none absolute size-20 rounded-full blur-2xl",
          t.glow
        )}
      />
      <div className="relative flex items-center gap-3">
        {/* Icon chip is desktop-only: on mobile the three pills share one
            compact row (P3-7) and the chips don't fit. */}
        <span
          className={cn(
            "hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex",
            t.chip
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="font-display font-bold text-base leading-none tabular-nums sm:text-xl">
            <CountUp value={value} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground sm:text-xs">
            <span>
              {label}
              {sub && (
                <span className="ml-1 text-muted-foreground/70">{sub}</span>
              )}
            </span>
            {help && <KpiHelp label={label}>{help}</KpiHelp>}
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
  // "N lb lost/gained", not a bare signed number (DSH-35).
  const weightValue =
    weightChange == null ? "—" : `${Math.abs(weightChange)} ${weightUnit}`;
  const weightLabel =
    weightChange == null
      ? "Weight change"
      : weightChange < 0
        ? "Lost since first weigh-in"
        : weightChange > 0
          ? "Gained since first weigh-in"
          : "Change since first weigh-in";

  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:flex sm:gap-3">
      <StatPill
        icon={<Flame className="size-5" strokeWidth={2.5} />}
        label="Calories eaten today"
        sub={calorieTarget ? `of ${calorieTarget.toLocaleString()}` : undefined}
        tone="amber"
        value={`${calories.toLocaleString()} cal`}
      />
      <StatPill
        help="Your latest weigh-in compared to your very first one. Log weigh-ins on the Progress page to keep it current."
        icon={
          (weightChange ?? 0) <= 0 ? (
            <TrendingDown className="size-5" strokeWidth={2.5} />
          ) : (
            <TrendingUp className="size-5" strokeWidth={2.5} />
          )
        }
        label={weightLabel}
        tone="violet"
        value={weightValue}
      />
      <StatPill
        help="Days out of the last 7 where you logged anything: a meal, water, sleep, a workout, or a weigh-in. Different from your streak, which counts consecutive days."
        icon={<Activity className="size-5" strokeWidth={2.5} />}
        label="Days active this week"
        tone="emerald"
        value={`${activeThisWeek} of 7`}
      />
    </div>
  );
}
