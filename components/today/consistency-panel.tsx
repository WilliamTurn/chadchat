"use client";

import {
  Droplets,
  Dumbbell,
  Flame,
  Moon,
  UtensilsCrossed,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CountUp } from "@/components/dashboard/count-up";
import { KpiHelp } from "@/components/dashboard/kpi";
import { SummaryPanel } from "@/components/panels/roles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * SEVEN-DAY LOGGING CONSISTENCY (FIX-24). SummaryPanel role, engagement
 * domain. Three layers in one aligned visual (the Duolingo streak grammar +
 * a domain-aware matrix, per the P56-D teardown):
 *
 *   1. The streak flame + count (streak strips are never removed, s181; the
 *      old header StreakStrip relocates here, upgraded, not deleted).
 *   2. The any-domain 7-day dot strip: the habit-streak reward. On a
 *      perfect-so-far week the dots connect into a glowing capsule (the
 *      Duolingo perfect-week collapse, tokenized emerald, reduced-motion
 *      safe: it is a static treatment, not an animation).
 *   3. Four domain rows (nutrition/hydration/sleep/training) sharing the
 *      same day columns, so the member can SEE which habits carried the week.
 *
 * Vocabulary law: "Logging consistency", never "active days"; a day counts
 * when anything is logged: consistency is showing up, not completion, and
 * the "?" says so in those words.
 *
 * Numbers: streak = engagement.streak.days (computeStreak); days-this-week =
 * engagement.consistency.week (getActivityDaysSince). Both arrive computed by
 * the page from the registered sources.
 */

export type ConsistencyDay = {
  /** "Su".."Sa". */
  label: string;
  /** "Mon, Jun 29": the real date, for tooltips. */
  dateLabel: string;
  /** Anything logged in any domain (the strip + streak source). */
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
};

export type ConsistencyDomainRow = {
  id: "nutrition" | "hydration" | "sleep" | "training";
  label: string;
  /** Per-day logged flags aligned to the week's 7 columns. */
  days: boolean[];
};

const DOMAIN_ICON = {
  nutrition: UtensilsCrossed,
  hydration: Droplets,
  sleep: Moon,
  training: Dumbbell,
} as const;

const DOMAIN_DOT = {
  nutrition: "bg-chart-3",
  hydration: "bg-chart-1",
  sleep: "bg-chart-4",
  training: "bg-blood",
} as const;

export function ConsistencyPanel({
  streak,
  week,
  domains,
  className,
}: {
  streak: number;
  week: ConsistencyDay[];
  domains: ConsistencyDomainRow[];
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const lit = streak > 0;
  const pastOrToday = week.filter((d) => !d.isFuture);
  const daysLogged = pastOrToday.filter((d) => d.active).length;
  // Perfect so far: every day of the week that has happened is logged.
  const perfectSoFar = pastOrToday.length > 0 && daysLogged === pastOrToday.length;
  const perfectWeek = perfectSoFar && pastOrToday.length === 7;

  const streakMeaning = lit
    ? streak === 1
      ? "You've logged something today. Come back tomorrow to make it 2."
      : `You've logged something ${streak} days in a row.`
    : "No streak yet. Log anything today to start one.";

  return (
    <SummaryPanel
      className={className}
      detailLink={{ label: "Progress", href: "/progress" }}
      empty={{
        absent: "Nothing logged this week yet.",
        unlock: "Log anything (a meal, water, sleep, a workout) and the week lights up.",
      }}
      glow={perfectSoFar ? "emerald" : undefined}
      headline={
        <span className="flex items-baseline gap-1.5">
          <CountUp value={`${daysLogged} of 7`} />
          <KpiHelp label="Logging consistency">
            Days this week (Sunday through Saturday) with at least one log in
            any domain. It counts showing up, not hitting every target. Your
            streak is the consecutive-days version, and misses reset it.
          </KpiHelp>
        </span>
      }
      icon={<Flame className="size-4" />}
      lockedCapability="Members see their week of logging at a glance: streak, days logged, and which habits carried it."
      state="populated"
      targetContext="days logged this week"
      title="Consistency"
      tone="emerald"
      visual={
        <div className="@container flex min-w-0 flex-col gap-3">
          {/* Streak line: the flame is the reward, the words are the fact. */}
          <div className="flex items-center gap-2">
            <motion.span
              animate={
                lit && !reduced
                  ? {
                      scale: [1, 1.12, 0.97, 1.06, 1],
                      rotate: [0, -3, 2, -1, 0],
                    }
                  : undefined
              }
              className="inline-flex"
              transition={
                lit && !reduced
                  ? {
                      duration: 1.8,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }
                  : undefined
              }
            >
              <Flame
                className={cn(
                  "size-5",
                  lit ? "text-blood" : "text-muted-foreground"
                )}
                fill={lit ? "currentColor" : "none"}
                strokeWidth={2.5}
              />
            </motion.span>
            <span className="font-display font-semibold text-sm">
              <CountUp value={`${streak}-day streak`} />
            </span>
          </div>
          {/* Full-width fact line: never truncated mid-sentence (audit P3-2). */}
          <p className="text-meta text-muted-foreground">{streakMeaning}</p>

          {/* The aligned week: labels, the any-domain strip, domain rows. */}
          <TooltipProvider>
            <div
              className="grid gap-x-1.5 gap-y-1.5"
              style={{
                gridTemplateColumns: "auto repeat(7, minmax(0, 1fr))",
              }}
            >
              {/* Day labels */}
              <span aria-hidden />
              {week.map((d) => (
                <span
                  className={cn(
                    "text-center text-meta",
                    d.isToday
                      ? "font-semibold text-foreground"
                      : d.isFuture
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground"
                  )}
                  key={`label-${d.dateLabel}`}
                >
                  {d.label}
                </span>
              ))}

              {/* The habit strip (never removed): any-domain dots. On a
                  perfect-so-far week the logged run connects into one glowing
                  capsule (tokenized emerald; static, reduced-motion safe). */}
              <span aria-hidden />
              <div
                className={cn(
                  "col-span-7 grid grid-cols-7 gap-x-1.5 rounded-full",
                  perfectSoFar &&
                    "bg-positive/15 shadow-[var(--shadow-glow-positive)] ring-1 ring-positive/40"
                )}
              >
                {week.map((d) => {
                  const value = d.isFuture
                    ? "Upcoming"
                    : d.active
                      ? "Logged"
                      : "Nothing logged";
                  return (
                    <Tooltip key={`dot-${d.dateLabel}`}>
                      <TooltipTrigger asChild>
                        <div
                          aria-label={`${d.dateLabel}: ${value}`}
                          className="flex cursor-default items-center justify-center rounded py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          tabIndex={0}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-3 rounded-full",
                              d.isFuture
                                ? "border border-border bg-transparent"
                                : d.active
                                  ? perfectSoFar
                                    ? "bg-positive"
                                    : "bg-blood shadow-[var(--shadow-glow-blood)]"
                                  : "bg-border",
                              d.isToday &&
                                "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background"
                            )}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="font-medium">{d.dateLabel}</span>
                        <span aria-hidden>·</span>
                        <span>{value}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Domain rows: which habits carried each day. */}
              {domains.map((row) => {
                const Icon = DOMAIN_ICON[row.id];
                const loggedLabels = week
                  .filter((d, i) => row.days[i] && !d.isFuture)
                  .map((d) => d.dateLabel);
                return (
                  <Tooltip key={row.id}>
                    <TooltipTrigger asChild>
                      <div
                        aria-label={`${row.label}: ${
                          loggedLabels.length > 0
                            ? `logged ${loggedLabels.join(", ")}`
                            : "nothing logged this week"
                        }`}
                        className="col-span-8 grid cursor-default grid-cols-subgrid items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        tabIndex={0}
                      >
                        <Icon
                          aria-hidden
                          className="mr-1 size-3 text-muted-foreground"
                        />
                        {week.map((d, i) => (
                          <span
                            aria-hidden
                            className="flex items-center justify-center py-0.5"
                            key={`${row.id}-${d.dateLabel}`}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                d.isFuture
                                  ? "bg-transparent"
                                  : row.days[i]
                                    ? DOMAIN_DOT[row.id]
                                    : "bg-border/70"
                              )}
                            />
                          </span>
                        ))}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="font-medium">{row.label}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {loggedLabels.length > 0
                          ? `${loggedLabels.length} day${loggedLabels.length === 1 ? "" : "s"} this week`
                          : "Nothing logged this week"}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>

          {perfectWeek && (
            <p className="font-medium text-meta text-positive-text">
              Perfect week: all 7 days logged.
            </p>
          )}
        </div>
      }
    />
  );
}
