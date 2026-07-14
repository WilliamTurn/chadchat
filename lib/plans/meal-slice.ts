import type { PlanDay, PlanDays } from "@/lib/validation/meal-plan";

/**
 * THE next-planned-meal slice (FIX-30; registered metric
 * `plans.mealSlice.today`). Pure and deterministic: the verdict derives
 * entirely from the plan document, the member-local day, and the count of
 * meals logged today, so it is inspectable, unit-testable, and two renders
 * of the same day can never disagree (the same inspectability law as
 * lib/plans/up-next.ts and lib/today/up-next.ts).
 *
 * DAY RULE (rotation semantics, matching the training rotation's positional
 * model): meal-plan days are a repeating rotation, not calendar-pinned
 * documents; today's day is the member-local days elapsed since the plan's
 * creation day, modulo the plan length. Stable across refreshes, advances
 * exactly once per member-local midnight, and works for any plan length
 * (1 to 7 days).
 *
 * MEAL RULE: the day's meals stay in PLAN ORDER (the order Chad designed the
 * day, never re-sorted); the next meal is that order advanced by the count
 * of meals logged today (nutrition.meals.today, the registered truthful
 * count). Once every planned meal is covered the slice says so explicitly;
 * it never fabricates a next meal.
 *
 * SAFE WHEN DATA IS MISSING: an empty plan returns null; a missing day
 * (defensive; the schema floors at 1 day) returns null.
 */

export const MS_PER_DAY = 86_400_000;

export type NextMealSlice = {
  /** The meal to eat next, in the plan day's own order. */
  title: string;
  slot: PlanDay["meals"][number]["slot"];
  /** 0-based position in the day's meal order. */
  position: number;
  calories: number;
  protein: number;
};

export type MealSliceToday = {
  /** 0-based rotation day for the member-local today. */
  dayIndex: number;
  dayCount: number;
  dayLabel: string;
  /** The plan document's own designed totals for today's rotation day. */
  plannedDay: { calories: number; protein: number };
  mealsPlanned: number;
  mealsLoggedToday: number;
  /** null once every planned meal is covered by today's logs. */
  nextMeal: NextMealSlice | null;
  /** Member-facing, factual WHY this meal is next (inspectability law). */
  reason: string;
};

export function mealSliceToday(args: {
  days: PlanDays;
  /** 00:00-UTC anchor (ms) of the member-local day the plan was created. */
  planStartDayMs: number;
  /** 00:00-UTC anchor (ms) of the member-local today. */
  todayDayMs: number;
  /** Meals logged today (nutrition.meals.today; truthful zero). */
  mealsLoggedToday: number;
}): MealSliceToday | null {
  const { days, planStartDayMs, todayDayMs, mealsLoggedToday } = args;
  if (days.length === 0) {
    return null;
  }
  const elapsed = Math.max(
    0,
    Math.round((todayDayMs - planStartDayMs) / MS_PER_DAY)
  );
  const dayIndex = elapsed % days.length;
  const day = days[dayIndex];
  if (!day || day.meals.length === 0) {
    return null;
  }

  const logged = Math.max(0, mealsLoggedToday);
  const next = logged < day.meals.length ? day.meals[logged] : null;

  const dayPhrase =
    days.length === 1
      ? day.label
      : `${day.label} (day ${dayIndex + 1} of ${days.length} in your rotation)`;

  return {
    dayIndex,
    dayCount: days.length,
    dayLabel: day.label,
    plannedDay: {
      calories: Math.round(day.totals.calories),
      protein: Math.round(day.totals.protein),
    },
    mealsPlanned: day.meals.length,
    mealsLoggedToday: logged,
    nextMeal: next
      ? {
          title: next.title,
          slot: next.slot,
          position: logged,
          calories: Math.round(next.totals.calories),
          protein: Math.round(next.totals.protein),
        }
      : null,
    reason: next
      ? logged === 0
        ? `First of ${day.meals.length} planned meals on ${dayPhrase}.`
        : `You've logged ${logged} of ${day.meals.length} planned meals today, so meal ${logged + 1} on ${dayPhrase} is next.`
      : `All ${day.meals.length} planned meals on ${dayPhrase} are covered by today's logs.`,
  };
}
