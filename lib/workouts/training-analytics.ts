/**
 * TRAINING ANALYTICS (FIX-33). Pure computations for Progress > Training:
 * weekly frequency, plan-adherence series, training milestones, muscle
 * distribution, and the alias-aware lookup-map helper the logger surfaces
 * use. No DB / React imports; server assembly lives in
 * lib/workouts/training-data.ts, and the one identity rule holds: analytics
 * inputs are canonicalized workouts (see lib/workouts/stats.ts header).
 *
 * Time convention: like every chart module, functions here take 00:00-UTC
 * member-local day anchors ({ t } events, ChartWindow, week bounds) computed
 * by the CALLER with the lib/date.ts *InTz helpers, so this module stays
 * deterministic and testable (the fixture-anchor idiom).
 */

import { type ChartWindow, toWeekSlots, type WeekSlot } from "@/lib/chart/window";
import { calendarDayAnchorInTz } from "@/lib/date";
import { weeklyPlanAdherence } from "@/lib/plans/adherence";
import type { PlanSchedule } from "@/lib/plans/schedule";
import type { CompletionEvent } from "@/lib/plans/up-next";
import {
  type ResolveOptions,
  resolveExerciseIdentity,
} from "./exercise-identity";
import { type WorkoutData, workoutVolumeLb } from "./stats";

/* ------------------------------------------------------ alias-aware lookups */

/**
 * Echo canonical-keyed map entries under the raw logged names too. The live
 * logger and prefill paths look maps up by the member's RAW typed/plan name
 * (`name.trim().toLowerCase()`); after canonicalization the map keys are
 * canonical display names, so a raw lookup ("bench press") would miss its
 * merged entry ("barbell bench press"). This adds the raw keys back as
 * aliases of the same entries: strictly a superset of the pre-FIX-33 lookup
 * behavior, never a regression.
 */
export function withAliasKeyEchoes<T>(
  map: Record<string, T>,
  rawWorkouts: WorkoutData[],
  opts: ResolveOptions = {}
): Record<string, T> {
  const out: Record<string, T> = { ...map };
  for (const w of rawWorkouts) {
    for (const ex of w.exercises) {
      const rawKey = ex.name.trim().toLowerCase();
      if (!rawKey || rawKey in out) {
        continue;
      }
      const canonicalDisplayKey = resolveExerciseIdentity(ex.name, opts)
        .canonicalName.trim()
        .toLowerCase();
      const entry = out[canonicalDisplayKey];
      if (entry !== undefined) {
        out[rawKey] = entry;
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------- frequency */

/**
 * Sessions per trailing 7-day bin across the window (the frequency trend
 * metric, training.frequency.weeklyTrend). `sessionDays` are the member-local
 * day anchors of logged sessions; zero-session weeks are truthful zero bars
 * (count carve-out in data-state.ts).
 */
export function weeklyFrequencySlots(
  sessionDays: readonly { t: number }[],
  window: ChartWindow
): WeekSlot[] {
  return toWeekSlots(window, sessionDays);
}

/**
 * Total training volume (lb) across sessions on or after `sinceDayMs`,
 * member-local day attribution (the training.volume.week metric with
 * sinceDayMs = the member's week start). One symbol so /workouts and
 * Progress > Training can never disagree on the same number.
 */
export function volumeSinceLb(
  workouts: readonly WorkoutData[],
  sinceDayMs: number,
  timezone: string | null
): number {
  return workouts
    .filter(
      (w) =>
        calendarDayAnchorInTz(new Date(w.performedAt), timezone).getTime() >=
        sinceDayMs
    )
    .reduce((sum, w) => sum + workoutVolumeLb(w), 0);
}

/* ------------------------------------------------------- adherence (weekly) */

export type WeekBounds = { startMs: number; endMs: number };

export type WeekAdherencePoint = {
  /** Week start day anchor (ms). */
  t: number;
  completed: number;
  planned: number;
};

/**
 * Completed-vs-planned sessions for each given member-local week, oldest
 * first. Composes P34-D's `weeklyPlanAdherence` per week (one adherence
 * semantic, never re-derived): planned = the CURRENT rotation size, the
 * shipped FIX-28 model.
 */
export function weeklyAdherenceSeries(args: {
  schedule: PlanSchedule;
  completions: CompletionEvent[];
  weeks: WeekBounds[];
}): WeekAdherencePoint[] {
  return args.weeks
    .map((week) => {
      const { plannedPerWeek, completedThisWeek } = weeklyPlanAdherence({
        schedule: args.schedule,
        completions: args.completions,
        weekStartMs: week.startMs,
        weekEndMs: week.endMs,
      });
      return { t: week.startMs, completed: completedThisWeek, planned: plannedPerWeek };
    })
    .sort((a, b) => a.t - b.t);
}

/* -------------------------------------------------------------- milestones */

export type TrainingMilestone = {
  /** Stable id ("session-count-50", "perfect-week-2026-06-28"). */
  id: string;
  kind: "session-count" | "perfect-week";
  /** Member-facing achievement ("50th workout logged"). */
  label: string;
  /** ISO instant (workout time) or day-anchor ISO (week milestones). */
  achievedAt: string;
  /** Source link target when a single workout produced the milestone. */
  workoutId?: string;
  detail?: string;
};

/** Session-count thresholds worth naming. Real counts only, never projected. */
export const SESSION_COUNT_MILESTONES = [
  1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000,
] as const;

const ORDINAL_SUFFIX: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };

function ordinal(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) {
    return `${n}th`;
  }
  return `${n}${ORDINAL_SUFFIX[n % 10] ?? "th"}`;
}

/**
 * The session-count milestones the member has REACHED, oldest first.
 * `headers` is the full workout list (id + performedAt, any order); pass the
 * complete history (the light header query), never a page-capped slice, so a
 * member past the hydration cap still gets truthful counts.
 */
export function sessionCountMilestones(
  headers: readonly { id: string; performedAt: string }[]
): TrainingMilestone[] {
  const ordered = [...headers].sort(
    (a, b) =>
      new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );
  const out: TrainingMilestone[] = [];
  for (const threshold of SESSION_COUNT_MILESTONES) {
    const nth = ordered[threshold - 1];
    if (!nth) {
      break;
    }
    out.push({
      id: `session-count-${threshold}`,
      kind: "session-count",
      label:
        threshold === 1 ? "First workout logged" : `${ordinal(threshold)} workout logged`,
      achievedAt: nth.performedAt,
      workoutId: nth.id,
    });
  }
  return out;
}

/** The next session-count milestone ahead, with progress toward it. */
export function nextSessionCountMilestone(totalSessions: number): {
  threshold: number;
  remaining: number;
} | null {
  const next = SESSION_COUNT_MILESTONES.find((t) => t > totalSessions);
  return next ? { threshold: next, remaining: next - totalSessions } : null;
}

/**
 * THE milestone timeline: every reached milestone from every kind, newest
 * first (the one pinned computation for training.milestones.timeline).
 */
export function mergeMilestoneTimeline(
  ...lists: TrainingMilestone[][]
): TrainingMilestone[] {
  return lists
    .flat()
    .sort(
      (a, b) =>
        new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()
    );
}

/**
 * Weeks where the member completed every prescribed plan session ("perfect
 * weeks"), oldest first. Only counts weeks with a real prescription
 * (planned > 0) and only from completion events (never projected). The
 * current, still-open week counts as soon as it is actually complete.
 */
export function perfectPlanWeekMilestones(args: {
  schedule: PlanSchedule;
  completions: CompletionEvent[];
  weeks: WeekBounds[];
}): TrainingMilestone[] {
  return weeklyAdherenceSeries(args)
    .filter((w) => w.planned > 0 && w.completed >= w.planned)
    .map((w) => {
      const day = new Date(w.t).toISOString().slice(0, 10);
      return {
        id: `perfect-week-${day}`,
        kind: "perfect-week" as const,
        label: "Perfect plan week",
        achievedAt: new Date(w.t).toISOString(),
        detail: `${w.completed} of ${w.planned} sessions completed`,
      };
    });
}

/* ------------------------------------------------------ muscle distribution */

export type MuscleGroupShare = {
  muscleGroup: string;
  /** Completed working sets attributed to the group inside the window. */
  sets: number;
};

/**
 * Completed working sets per muscle group across the given workouts (callers
 * pre-filter to the window). Rows without a muscleGroup are reported under
 * the explicit "unspecified" bucket so coverage stays honest; the surface
 * shows the distribution only when specified rows dominate (claims
 * discipline decided at the call site).
 */
export function muscleGroupDistribution(
  workouts: readonly WorkoutData[]
): MuscleGroupShare[] {
  const bySlug = new Map<string, number>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const group = ex.muscleGroup?.trim().toLowerCase() || "unspecified";
      let sets = 0;
      for (const s of ex.sets) {
        if (s.completed && s.setType !== "warmup") {
          sets++;
        }
      }
      if (sets > 0) {
        bySlug.set(group, (bySlug.get(group) ?? 0) + sets);
      }
    }
  }
  return [...bySlug.entries()]
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
    .sort((a, b) => b.sets - a.sets);
}
