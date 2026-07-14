import {
  hydrationWindow,
  nutritionAdherenceWindow,
  sleepWindow,
  type WindowSummary,
} from "@/lib/progress/overview";
import type {
  HydrationPanelData,
  NutritionPanelData,
  SleepPanelData,
} from "@/lib/today/panel-data";

/**
 * PROGRESS-HIGHLIGHT WINDOWS FOR TODAY (P56-E). Pure adapters that grade the
 * CURRENT WEEK's tracking data through the registered overview source
 * symbols (lib/progress/overview.ts: nutritionAdherenceWindow,
 * hydrationWindow, sleepWindow), so the Today highlights and the /progress
 * overview can never disagree about what "a day within target" means.
 *
 * The window is the elapsed part of the member's Sunday-start week: FUTURE
 * days are excluded from the anchors entirely (a day that has not happened
 * is not "unlogged"; grading it would inflate the denominator dishonestly).
 * Inputs are P56-C's canonical panel assemblers, whose week days already
 * carry the FIX-07 effective-dated per-day targets.
 */

function elapsedAnchors(week: ReadonlyArray<{ t: number; isFuture: boolean }>) {
  return week.filter((d) => !d.isFuture).map((d) => d.t);
}

/** nutrition.adherence.window over the elapsed week (per-day targets). */
export function nutritionWeekAdherence(
  week: NutritionPanelData["week"]
): WindowSummary {
  return nutritionAdherenceWindow({
    dayAnchorsMs: elapsedAnchors(week),
    caloriesByDay: new Map(
      week.filter((d) => d.logged).map((d) => [d.t, d.calories])
    ),
    targetByDay: new Map(
      week.map((d) => [d.t, d.target?.calories ?? null])
    ),
  });
}

/** hydration.daysAtGoal.window over the elapsed week (per-day goals). */
export function hydrationWeekAtGoal(
  week: HydrationPanelData["week"]
): WindowSummary {
  return hydrationWindow({
    dayAnchorsMs: elapsedAnchors(week),
    mlByDay: new Map(week.filter((d) => d.logged).map((d) => [d.t, d.ml])),
    goalMlByDay: new Map(week.map((d) => [d.t, d.goalMl])),
  });
}

/** sleep.nightsAtGoal.window over the elapsed week (per-night goals). */
export function sleepWeekAtGoal(week: SleepPanelData["week"]): WindowSummary {
  return sleepWindow({
    dayAnchorsMs: elapsedAnchors(week),
    minutesByDay: new Map(
      week.filter((n) => n.logged).map((n) => [n.t, n.minutes])
    ),
    goalMinutesByDay: new Map(week.map((n) => [n.t, n.goalMinutes])),
  });
}
