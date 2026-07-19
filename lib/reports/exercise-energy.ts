/**
 * Calories-burned Phase 4: the weekly report's exercise-calorie line —
 * this week's estimated exercise calories vs last week's, summed from the
 * same per-session estimates the workout cards show (energy.workout.kcal),
 * priced against the latest weigh-in (plan §6's read-time rule). Pure math
 * + formatting; the report engine fetches the two weeks of rows.
 *
 * Registry: energy.exercise.kcalPerWeek (source: weekExerciseKcal).
 *
 * WORDING GATE: the block text below is prompt text Chad reads when
 * writing the weekly report. Changes need the owner's authorization on the
 * exact wording; this is the Phase 4 draft presented for approval.
 */

import {
  exerciseKcalForDay,
  type LoggedSession,
  sessionNetKcal,
} from "@/lib/energy/workout-energy";

export type WeekExerciseKcal = {
  /** Sum of the week's computable session estimates; null = none. */
  kcal: number | null;
  /** How many of the week's sessions had a computable estimate. */
  sessions: number;
};

/** One week of logged sessions → the estimated exercise-calorie total. */
export function weekExerciseKcal(
  sessions: ReadonlyArray<LoggedSession>,
  weightKg: number | null
): WeekExerciseKcal {
  const estimates = sessions.map((s) => sessionNetKcal(s, weightKg));
  return {
    kcal: exerciseKcalForDay(estimates),
    sessions: estimates.filter((k) => k != null).length,
  };
}

/**
 * The computed block the report prompt carries — same contract as the
 * weight-trend block: the app did the math, Chad narrates it exactly.
 * Empty string when neither week has a computable estimate (no block, no
 * line — the report never guesses at burn).
 */
export function formatExerciseCalories(
  thisWeek: WeekExerciseKcal,
  lastWeek: WeekExerciseKcal
): string {
  if (thisWeek.kcal == null && lastWeek.kcal == null) {
    return "";
  }
  const week = (w: WeekExerciseKcal) =>
    w.kcal == null
      ? "no sessions with a computable estimate"
      : `~${w.kcal.toLocaleString()} kcal across ${w.sessions} session${w.sessions === 1 ? "" : "s"}`;
  return `COMPUTED EXERCISE CALORIES (already calculated by the app with the same estimates the client sees on their workout cards — use these numbers exactly, do not recalculate; they are estimates, so keep the ~ framing):
- This report week: ${week(thisWeek)}.
- The week before: ${week(lastWeek)}.

Include exactly ONE line in the TRAINING section comparing this week's exercise calories to the week before. One line, no more; the training work itself stays the focus.`;
}
