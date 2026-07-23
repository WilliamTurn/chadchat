"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMinutesAsDuration } from "@/lib/contracts/units";
import { cn } from "@/lib/utils";

/**
 * NIGHT COLUMNS (P56-C, FIX-27; new signature visual type per briefing rule
 * 9). The sleep panel's week: one moonlit column per night rising toward the
 * goal line, quality carried in the glow, missing nights as honest hollow
 * slots. The duration-vs-goal column week is the form the honest leaders use
 * for duration-only data (rule-8 evidence: Apple Health's sleep duration
 * columns with goal line, Gentler Streak's nightly bars; scores and
 * hypnograms need stage/HR data we do not have, so they would be fabricated
 * here; see evidence-p56c/benchmark-teardown.md). Pure SVG-free DOM + motion
 * on installed deps: zero added first-load bytes (FIX-41).
 *
 * Honesty rules: a missing night is a hollow dashed slot, never a 0h column
 * (data-state law); the goal line sits at each night's own effective-dated
 * goal (FIX-07), drawn continuous when the week's goal never changed and as
 * per-column ticks when it did; quality only brightens what was actually
 * rated. The DSH-64 fix: `placeholder` renders the designed axis-only
 * variant (goal line + hollow slots) so the chart slot exists from night
 * zero.
 */

export type NightColumn = {
  /** Stable key (the night's day-anchor ms). */
  key: string | number;
  /** "Su".."Sa". */
  label: string;
  /** "Mon, Jun 29": the real date, for tooltips. */
  dateLabel: string;
  /** Minutes slept; null = not logged (hollow slot, never zero). */
  minutes: number | null;
  /** The goal active on that night (FIX-07 effective-dated). */
  goalMinutes: number;
  /** Optional 1..5 self-rating; brightens the column's glow. */
  quality: number | null;
  isToday: boolean;
  isFuture: boolean;
};

/** Fill opacity by quality rating; unrated nights sit in the middle. */
function qualityOpacity(quality: number | null): number {
  if (quality == null) {
    return 0.75;
  }
  return 0.45 + quality * 0.11; // 1 -> 0.56 ... 5 -> 1.0
}

export function NightColumns({
  nights,
  height = 84,
  placeholder = false,
  className,
}: {
  nights: NightColumn[];
  height?: number;
  /** DSH-64: the designed empty variant (goal line + hollow slots only). */
  placeholder?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const goals = nights.map((n) => n.goalMinutes);
  const uniformGoal = goals.every((g) => g === goals[0]) ? goals[0] : null;
  // Scale: the tallest of goal * 1.15 and the longest night, so the goal line
  // always sits INSIDE the plot and a long night still fits.
  const scaleMax = Math.max(
    ...goals.map((g) => g * 1.15),
    ...nights.map((n) => n.minutes ?? 0),
    1
  );
  const goalPct = uniformGoal ? (uniformGoal / scaleMax) * 100 : null;

  return (
    <TooltipProvider>
      <div
        className={cn("relative flex items-end gap-1.5", className)}
        style={{ height }}
      >
        {/* Continuous goal line when one goal governed the whole week. */}
        {goalPct != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-border border-t border-dashed"
            style={{ bottom: `${goalPct}%` }}
          />
        )}

        {nights.map((night, i) => {
          const logged = !placeholder && night.minutes != null && !night.isFuture;
          const met = logged && (night.minutes as number) >= night.goalMinutes;
          const pct = logged
            ? Math.max(((night.minutes as number) / scaleMax) * 100, 8)
            : 100;
          const value = night.isFuture
            ? "Upcoming"
            : logged
              ? formatMinutesAsDuration(night.minutes as number)
              : "Not logged";
          const status = logged
            ? met
              ? "Goal met"
              : `${formatMinutesAsDuration(night.goalMinutes - (night.minutes as number))} short of ${formatMinutesAsDuration(night.goalMinutes)}`
            : undefined;
          const summary = `${night.dateLabel}: ${value}${status ? `, ${status}` : ""}`;

          return (
            <Tooltip key={night.key}>
              <TooltipTrigger asChild>
                {/* biome-ignore-start lint/a11y/noNoninteractiveTabindex: keyboard users need focus on the column to summon its tooltip (WCAG 1.4.13). */}
                <div
                  aria-label={summary}
                  className="relative flex h-full flex-1 items-end"
                  role="img"
                  tabIndex={0}
                >
                  {/* biome-ignore-end lint/a11y/noNoninteractiveTabindex: see above. */}
                  {/* Per-column goal tick when goals differ across the week
                      (a mid-week FIX-07 goal change stays visible). */}
                  {uniformGoal == null && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 border-border border-t border-dashed"
                      style={{
                        bottom: `${(night.goalMinutes / scaleMax) * 100}%`,
                      }}
                    />
                  )}
                  {logged ? (
                    <motion.div
                      animate={{ height: `${pct}%` }}
                      className={cn(
                        // Theme-aware fills (FIX-19 pattern): darker stops on
                        // light cards so the graphic clears 3:1, brighter on
                        // dark where the 600s would sink into the card.
                        "w-full rounded-full bg-gradient-to-t",
                        met
                          ? "from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-indigo-300"
                          : "from-indigo-600/80 to-indigo-500/60 dark:from-indigo-500/80 dark:to-indigo-400/60",
                        night.isToday &&
                          "ring-1 ring-foreground/60 ring-offset-1 ring-offset-background"
                      )}
                      initial={reduce ? false : { height: "8%" }}
                      style={{
                        opacity: qualityOpacity(night.quality),
                        // Goal-met glow, tokenized (owner reward-glow order);
                        // inline so the class stays on-system (FIX-37).
                        boxShadow: met
                          ? "0 0 10px var(--chart-4)"
                          : undefined,
                      }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : {
                              type: "spring",
                              stiffness: 120,
                              damping: 20,
                              delay: i * 0.03,
                            }
                      }
                    />
                  ) : (
                    <div
                      className={cn(
                        "h-full w-full rounded-full border border-border border-dashed",
                        (night.isFuture || placeholder) && "opacity-40",
                        night.isToday &&
                          !placeholder &&
                          "ring-1 ring-foreground/40 ring-offset-1 ring-offset-background"
                      )}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-medium">{night.dateLabel}</span>
                <span aria-hidden>·</span>
                <span>{value}</span>
                {status ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{status}</span>
                  </>
                ) : null}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
