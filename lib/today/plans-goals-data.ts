import "server-only";

import { calendarDayAnchorInTz, todayAnchorInTz } from "@/lib/date";
import {
  getOutcomesForGoals,
  getPlanSessionCompletions,
  resolvePlanScheduleView,
} from "@/lib/db/plan-goal-queries";
import { getBodyMeasurementsByUserId } from "@/lib/db/queries";
import type { Goal, MealPlan, Plan, User } from "@/lib/db/schema";
import {
  buildGoalVM,
  type GoalValueVM,
  latestMeasurementsByKind,
} from "@/lib/goals/outcome-values";
import { weeklyPlanAdherence } from "@/lib/plans/adherence";
import { type MealSliceToday, mealSliceToday } from "@/lib/plans/meal-slice";
import {
  type CompletionEvent,
  selectUpNextSession,
  type UpNextVerdict,
} from "@/lib/plans/up-next";
import { planDaysSchema } from "@/lib/validation/meal-plan";
import { getResolveOptions } from "@/lib/workouts/canonical";
import { canonicalizeWorkouts } from "@/lib/workouts/exercise-identity";
import type { WorkoutData } from "@/lib/workouts/stats";

/**
 * CANONICAL PLANS-AND-GOALS ASSEMBLERS (P56-E, FIX-30). One server-side
 * assembler per Today summary card, the same pattern as P56-C's
 * lib/today/panel-data.ts: every mount feeds the SAME values through the
 * SAME source modules, so a Today summary and its authoritative detail page
 * can never disagree (the one-canonical-value law at the data layer).
 *
 *   - Training today: P34-D's resolvePlanScheduleView + selectUpNextSession
 *     (the SAME verdict Up next consumes; this module never re-decides the
 *     session) + weeklyPlanAdherence for the week numbers.
 *   - Meal plan today: the registered plans.mealSlice.today metric
 *     (lib/plans/meal-slice.ts) over the plan document.
 *   - Primary goal: the FIX-29 outcome resolver through the shared
 *     lib/goals/outcome-values.ts VM builder, identical to /progress.
 *
 * Callers gate on tier BEFORE calling where the data is Pro-scoped; the
 * panels themselves render locked/empty states without member data.
 */

export type TrainingTodayData = {
  planId: string;
  planTitle: string;
  kind: "structured" | "legacy-days" | "document";
  /** The deterministic next session (null for document plans). */
  verdict: UpNextVerdict | null;
  /** A completion event exists for the member-local today. */
  trainedToday: boolean;
  /** The session name completed today, when one exists (the done state). */
  completedTodayName: string | null;
  /** Rotation order + whether each session completed this week. */
  rotation: { name: string; completedThisWeek: boolean }[];
  /** weeklyPlanAdherence (training.plan.completion.week); null = document. */
  adherence: { completedThisWeek: number; plannedPerWeek: number } | null;
  /** Raw completion events, so the page's Up next input reuses this fetch. */
  completions: CompletionEvent[];
};

export async function getTrainingTodayData(args: {
  user: User;
  /** The active training plan (caller already fetched the plans list). */
  plan: Plan;
  /** Sunday-start week bounds + today, member-local 00:00-UTC anchors (ms). */
  weekStartMs: number;
  weekEndMs: number;
  todayAnchorMs: number;
}): Promise<TrainingTodayData> {
  const { user, plan, weekStartMs, weekEndMs, todayAnchorMs } = args;
  const scheduleView = await resolvePlanScheduleView(plan);
  if (scheduleView.kind === "document") {
    return {
      planId: plan.id,
      planTitle: plan.title,
      kind: "document",
      verdict: null,
      trainedToday: false,
      completedTodayName: null,
      rotation: [],
      adherence: null,
      completions: [],
    };
  }

  const completionRows = await getPlanSessionCompletions({
    planId: plan.id,
    userId: user.id,
  });
  const completions: CompletionEvent[] = completionRows.map((c) => ({
    planSessionId: c.planSessionId,
    completedDayMs: c.completedDay.getTime(),
  }));

  const completedThisWeekBySession = new Set<string>();
  for (const c of completions) {
    if (c.completedDayMs >= weekStartMs && c.completedDayMs < weekEndMs) {
      completedThisWeekBySession.add(c.planSessionId);
    }
  }
  const completedTodayRow = completionRows.find(
    (c) => c.completedDay.getTime() === todayAnchorMs
  );

  const sessions = [...scheduleView.schedule.sessions].sort(
    (a, b) => a.position - b.position
  );

  return {
    planId: plan.id,
    planTitle: plan.title,
    kind: scheduleView.kind,
    verdict: selectUpNextSession(scheduleView.schedule, completions),
    trainedToday: completedTodayRow != null,
    completedTodayName: completedTodayRow?.sessionName ?? null,
    rotation: sessions.map((s) => ({
      name: s.name,
      completedThisWeek:
        s.id !== null && completedThisWeekBySession.has(s.id),
    })),
    adherence: weeklyPlanAdherence({
      schedule: scheduleView.schedule,
      completions,
      weekStartMs,
      weekEndMs,
    }),
    completions,
  };
}

/** The meal-plan slice for the member-local today (plans.mealSlice.today). */
export function getMealSliceForToday(args: {
  user: User;
  mealPlan: MealPlan;
  /** Meals logged today (nutrition.meals.today from the nutrition assembler). */
  mealsLoggedToday: number;
}): MealSliceToday | null {
  const { user, mealPlan, mealsLoggedToday } = args;
  const parsed = planDaysSchema.safeParse(mealPlan.days);
  if (!parsed.success) {
    return null;
  }
  return mealSliceToday({
    days: parsed.data,
    planStartDayMs: calendarDayAnchorInTz(
      mealPlan.createdAt,
      user.timezone
    ).getTime(),
    todayDayMs: todayAnchorInTz(user.timezone).getTime(),
    mealsLoggedToday,
  });
}

export type PrimaryGoalData = {
  vm: GoalValueVM;
  /** Active goals beyond the featured one (the "All goals" line). */
  otherActiveGoals: number;
};

/**
 * The featured Today goal: the FIRST active goal in the canonical
 * getActiveGoalsByUserId order (newest first), the same goal that leads the
 * /progress overview's goal cards, resolved through the same shared module.
 */
export async function getPrimaryGoalData(args: {
  user: User;
  /** Active goals in getActiveGoalsByUserId order (caller already fetched). */
  goals: Goal[];
  /** The canonical trend weight in the member's display unit (LC-4). */
  trendWeight: number | null;
  trendUnit: "lb" | "kg";
  /** The workouts the page already hydrated (canonicalized here). */
  workouts: WorkoutData[];
}): Promise<PrimaryGoalData | null> {
  const { user, goals, trendWeight, trendUnit, workouts } = args;
  const primary = goals[0];
  if (!primary) {
    return null;
  }

  const outcomeRows =
    (
      await getOutcomesForGoals({ goalIds: [primary.id], userId: user.id })
    ).get(primary.id) ?? [];

  // Fetch only what the outcomes actually read: identity resolution when an
  // e1rm outcome exists, measurements when a measurement outcome exists.
  const legacyKind = primary.metric;
  const needsWorkouts =
    outcomeRows.some((o) => o.metricId === "training.exercise.e1rm") ||
    (outcomeRows.length === 0 && legacyKind === "lift");
  const needsMeasurements =
    outcomeRows.some((o) => o.metricId === "body.measurement") ||
    (outcomeRows.length === 0 && legacyKind === "measurement");

  const canonicalWorkouts = needsWorkouts
    ? canonicalizeWorkouts(workouts, await getResolveOptions(user.id))
    : workouts;
  const latestMeasurementByKind = needsMeasurements
    ? latestMeasurementsByKind(await getBodyMeasurementsByUserId(user.id))
    : new Map<string, number>();

  return {
    vm: buildGoalVM(primary, outcomeRows, {
      trendWeight,
      trendUnit,
      canonicalWorkouts,
      latestMeasurementByKind,
    }),
    otherActiveGoals: goals.length - 1,
  };
}
