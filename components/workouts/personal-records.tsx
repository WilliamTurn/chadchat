/**
 * PR list with a per-exercise est-1RM drill-down (FIX-33, migrated onto the
 * P2 chart grammar). Each row shows the best estimated 1RM plus the heaviest
 * logged set; tapping a row opens a full-width panel charting that
 * exercise's estimated 1RM on a window-spanning axis with GOLD DOTS on the
 * record sessions, and every record links to the exact workout that set it
 * (the Hevy record-to-source tap-through; evidence-p56b/benchmark-teardown.md
 * section 2d). Records are computed over canonicalized history, so aliases
 * share one card. All math is server-side; this is presentation + the
 * expand interaction.
 */

"use client";

import { ArrowUpRight, ChevronDown, Trophy } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChartFrame } from "@/components/charts/chart-frame";
import { useUrlParam } from "@/hooks/use-url-state";
import { buildChartSummary } from "@/lib/chart/summary";
import { MS_PER_DAY } from "@/lib/chart/trend";
import { windowFromExtent } from "@/lib/chart/window";
import { loggedReading } from "@/lib/contracts/data-state";
import { idParam } from "@/lib/url-state";
import type { PersonalRecord } from "@/lib/workouts/stats";
import { ExerciseTrendChart } from "./exercise-trend-chart";

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

/** Tokenized reward glow for the trophy marks (owner reward-glow direction),
 *  derived from the amber record hue via color-mix like TREND_GLOW. */
const TROPHY_GLOW =
  "[filter:drop-shadow(0_0_5px_color-mix(in_oklab,var(--chart-3)_60%,transparent))]";

export type PersonalRecordWithTrend = PersonalRecord & {
  /** Best est-1RM per session (lb), oldest → newest. */
  trend: { t: number; value: number }[];
};

export function PersonalRecords({
  records,
  prMarkers = {},
  todayMs,
}: {
  records: PersonalRecordWithTrend[];
  /** Session anchors that set an est-1RM record, keyed by exercise name
   *  (from prEventsByWorkout: one replay, so dots == pills == timeline). */
  prMarkers?: Record<string, number[]>;
  /** 00:00-UTC anchor of the member-local today (window math). */
  todayMs?: number;
}) {
  // URL-synced (FIX-03): the open drill-down lives at `?pr=<exercise name>`,
  // so a deep link opens it and back/forward restores it. Opening PUSHES a
  // history entry (Back closes the panel, the nuqs open-a-panel convention);
  // closing in the UI replaces (no forward junk).
  const [openName, setOpenName] = useUrlParam("pr", idParam());
  const reduced = useReducedMotion() ?? false;

  // The drill-down renders after the whole grid; on a phone that is below
  // the fold, so an untracked open reads as "the tap did nothing" (mobile
  // audit P2). Bring the panel into view when it opens; deep links land on
  // it the same way.
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (openName) {
      panelRef.current?.scrollIntoView({
        block: "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
    }
  }, [openName, reduced]);

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
              className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-[var(--go)]/50 ${
                isOpen ? "border-[var(--go)]/60" : "border-border"
              }`}
              key={r.exerciseName}
              onClick={() =>
                isOpen
                  ? setOpenName(null)
                  : setOpenName(r.exerciseName, { history: "push" })
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
                      : "No weights entered yet"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5 text-right">
                {r.bestEst1RM != null ? (
                  <div className="flex items-center gap-1.5">
                    <Trophy
                      className={`size-4 text-amber-500 ${TROPHY_GLOW}`}
                    />
                    <div>
                      <div className="font-display font-semibold text-base leading-none">
                        {r.bestEst1RM}
                        <span className="ml-0.5 font-normal text-muted-foreground text-xs">
                          {r.est1RMUnit}
                        </span>
                      </div>
                      <div className="text-meta text-muted-foreground uppercase tracking-wide">
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
            className="overflow-hidden scroll-mt-20"
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            initial={reduced ? false : { height: 0, opacity: 0 }}
            key={open.exerciseName}
            onAnimationComplete={() =>
              panelRef.current?.scrollIntoView({
                block: "nearest",
                behavior: reduced ? "auto" : "smooth",
              })
            }
            ref={panelRef}
            transition={reduced ? { duration: 0 } : SPRING}
          >
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{open.exerciseName}</h3>
                  {gain != null && gain !== 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium text-meta ${
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

              <DrillDownChart
                prTs={prMarkers[open.exerciseName] ?? []}
                record={open}
                todayMs={todayMs}
              />

              {/* Record-to-source tap-through (the crown-jewel interaction). */}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {open.bestWeight != null && open.bestWeightWorkoutId && (
                  <RecordSourceLink
                    label={`Top set ${open.bestWeight}${open.bestWeightUnit}${open.bestWeightReps != null ? ` × ${open.bestWeightReps}` : ""}`}
                    workoutId={open.bestWeightWorkoutId}
                  />
                )}
                {open.bestEst1RM != null &&
                  open.bestEst1RMWorkoutId &&
                  open.bestEst1RMWorkoutId !== open.bestWeightWorkoutId && (
                    <RecordSourceLink
                      label={`Best est. 1RM ${open.bestEst1RM} ${open.est1RMUnit}`}
                      workoutId={open.bestEst1RMWorkoutId}
                    />
                  )}
                <Link
                  className="inline-flex min-h-11 items-center gap-1 text-muted-foreground text-xs underline-offset-4 hover:underline sm:min-h-0"
                  href={`/workouts/exercises/${encodeURIComponent(open.exerciseName)}`}
                >
                  All records and history
                  <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              </div>

              <p className="mt-3 text-meta text-muted-foreground">
                Estimated 1RM: the most Chad estimates you could lift once,
                calculated from each set's weight and reps with the Epley
                formula. Gold dots mark the sessions that set a new record.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function DrillDownChart({
  record,
  prTs,
  todayMs,
}: {
  record: PersonalRecordWithTrend;
  prTs: number[];
  todayMs?: number;
}) {
  const endDayMs =
    todayMs ??
    (record.trend.length > 0
      ? Math.max(...record.trend.map((p) => p.t))
      : Date.now() - (Date.now() % MS_PER_DAY));
  const window = windowFromExtent(record.trend, endDayMs);

  if (record.trend.length < 2) {
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">
        Log {record.exerciseName} again to see your strength trend. One
        session isn't a trend yet.
      </p>
    );
  }

  const latest = record.trend.at(-1);
  const trendFirst = record.trend[0];
  const reading = loggedReading(latest?.value ?? 0, {
    coverage: {
      loggedDays: record.trend.length,
      windowDays: window.days,
      points: record.trend.length,
      spanDays:
        latest && trendFirst
          ? Math.round((latest.t - trendFirst.t) / MS_PER_DAY)
          : 0,
    },
    estimated: true,
  });

  return (
    <ChartFrame
      chrome={false}
      compact
      height={220}
      reading={reading}
      state="populated"
      summary={buildChartSummary({
        title: `${record.exerciseName} estimated 1RM`,
        rangeLabel: "all time",
        reading,
        unit: "lb",
        extra: [
          `${prTs.length} record ${prTs.length === 1 ? "session" : "sessions"} marked with gold dots`,
          `All-time best ${record.bestEst1RM ?? "not yet estimated"} lb`,
        ],
      })}
      title={`${record.exerciseName} estimated 1RM`}
      unit="lb"
    >
      <ExerciseTrendChart
        points={record.trend}
        prTs={prTs}
        unit={record.est1RMUnit}
        window={window}
      />
    </ChartFrame>
  );
}

function RecordSourceLink({
  label,
  workoutId,
}: {
  label: string;
  workoutId: string;
}) {
  return (
    <Link
      className="inline-flex min-h-11 items-center gap-1 text-xs underline-offset-4 hover:underline sm:min-h-0"
      href={`/workouts/history/${workoutId}`}
    >
      <Trophy aria-hidden className={`size-3.5 text-amber-500 ${TROPHY_GLOW}`} />
      {label}
      <span className="text-muted-foreground">· View workout</span>
      <ArrowUpRight aria-hidden className="size-3.5 text-muted-foreground" />
    </Link>
  );
}
