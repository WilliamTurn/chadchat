import type { PlanSchedule } from "./schedule";
import type { CompletionEvent } from "./up-next";

/**
 * Plan adherence from the completion event stream (FIX-28). The model is the
 * category-standard frequency ratio (Fitbod/Whoop tier, see
 * evidence-p34d/benchmark-teardown.md section 3.2): sessions completed in a
 * member-local week vs the rotation's prescribed sessions per week, plus the
 * per-session planned-vs-completed pairing that TrainingPeaks-style detail
 * views need. Pure: week bounds are computed by the caller with the
 * lib/date.ts member-timezone helpers (this module never does date math on
 * raw Dates), and completions are immutable events, so a plan edit or target
 * change NEVER rewrites a past week's adherence (the FIX-07 philosophy).
 */

export type WeekAdherence = {
  /** Prescribed sessions per week (the rotation size). */
  plannedPerWeek: number;
  /** Completions inside [weekStartMs, weekEndMs). */
  completedThisWeek: number;
};

export function weeklyPlanAdherence(args: {
  schedule: PlanSchedule;
  completions: CompletionEvent[];
  weekStartMs: number;
  weekEndMs: number;
}): WeekAdherence {
  const { schedule, completions, weekStartMs, weekEndMs } = args;
  return {
    plannedPerWeek: schedule.sessions.length,
    completedThisWeek: completions.filter(
      (c) => c.completedDayMs >= weekStartMs && c.completedDayMs < weekEndMs
    ).length,
  };
}

export type SessionCompletionStatus = {
  planSessionId: string;
  /** Most recent completion day anchor (epoch ms); null = never completed. */
  lastCompletedDayMs: number | null;
  /** Completions inside the caller's window. */
  completedInWindow: number;
};

/** Per-session pairing for plan-detail adherence views. */
export function sessionCompletionStatuses(args: {
  schedule: PlanSchedule;
  completions: CompletionEvent[];
  windowStartMs: number;
  windowEndMs: number;
}): SessionCompletionStatus[] {
  const { schedule, completions, windowStartMs, windowEndMs } = args;
  return schedule.sessions
    .filter((s) => s.id !== null)
    .map((s) => {
      const mine = completions.filter((c) => c.planSessionId === s.id);
      const last = mine.reduce<number | null>(
        (acc, c) => (acc === null || c.completedDayMs > acc ? c.completedDayMs : acc),
        null
      );
      return {
        planSessionId: s.id as string,
        lastCompletedDayMs: last,
        completedInWindow: mine.filter(
          (c) => c.completedDayMs >= windowStartMs && c.completedDayMs < windowEndMs
        ).length,
      };
    });
}
