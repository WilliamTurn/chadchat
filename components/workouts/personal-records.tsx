/**
 * PR list with a per-exercise est-1RM drill-down. Each row shows the best
 * estimated 1RM plus the heaviest logged set; tapping a row opens a full-width
 * panel below the grid charting that exercise's estimated 1RM over time
 * (Hevy-style exercise history). Client component for the expand interaction;
 * all the math is computed server-side and passed in.
 */

"use client";

import { ChevronDown, Trophy } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { PersonalRecord } from "@/lib/workouts/stats";
import { ExerciseTrendChart } from "./exercise-trend-chart";

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

export type PersonalRecordWithTrend = PersonalRecord & {
  /** Best est-1RM per session (lb), oldest → newest. */
  trend: { t: number; value: number }[];
};

export function PersonalRecords({
  records,
}: {
  records: PersonalRecordWithTrend[];
}) {
  const [openName, setOpenName] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;

  if (records.length === 0) {
    return null;
  }

  const open = records.find((r) => r.exerciseName === openName) ?? null;
  // Strength gained from the first logged session to the latest, for the badge.
  const first = open?.trend[0]?.value;
  const last = open?.trend.at(-1)?.value;
  const gain =
    open && open.trend.length >= 2 && first != null && last != null
      ? last - first
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {records.map((r) => {
          const isOpen = r.exerciseName === openName;
          return (
            <button
              aria-expanded={isOpen}
              className={`flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-blood/50 ${
                isOpen ? "border-blood/60" : "border-border"
              }`}
              key={r.exerciseName}
              onClick={() =>
                setOpenName((prev) =>
                  prev === r.exerciseName ? null : r.exerciseName
                )
              }
              type="button"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-sm">
                  {r.exerciseName}
                </div>
                <div className="text-muted-foreground text-xs">
                  {r.bestWeight != null
                    ? `Top set ${r.bestWeight}${r.bestWeightUnit}${r.bestWeightReps != null ? ` × ${r.bestWeightReps}` : ""}`
                    : r.bestReps != null
                      ? `Best ${r.bestReps} reps`
                      : "Logged"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5 text-right">
                {r.bestEst1RM != null ? (
                  <div className="flex items-center gap-1.5">
                    <Trophy className="size-4 text-amber-500" />
                    <div>
                      <div className="font-display font-semibold text-base leading-none">
                        {r.bestEst1RM}
                        <span className="ml-0.5 font-normal text-muted-foreground text-xs">
                          {r.est1RMUnit}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        est. 1RM
                      </div>
                    </div>
                  </div>
                ) : null}
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  className="text-muted-foreground"
                  transition={reduced ? { duration: 0 } : SPRING}
                >
                  <ChevronDown className="size-4" />
                </motion.span>
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.section
            animate={reduced ? undefined : { height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            initial={reduced ? false : { height: 0, opacity: 0 }}
            key={open.exerciseName}
            transition={reduced ? { duration: 0 } : SPRING}
          >
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{open.exerciseName}</h3>
                  {gain != null && gain !== 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium text-[11px] ${
                        gain > 0
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {gain > 0 ? "+" : "−"}
                      {Math.abs(gain)} {open.est1RMUnit} since first
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground text-xs">
                  est. 1RM over time
                </span>
              </div>
              {open.trend.length >= 2 ? (
                <ExerciseTrendChart points={open.trend} unit={open.est1RMUnit} />
              ) : (
                <p className="py-6 text-center text-muted-foreground text-sm">
                  Log {open.exerciseName} again to see your strength trend. One
                  session isn't a trend yet.
                </p>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
