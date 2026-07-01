/**
 * NUT-13 — one macro target, not two.
 *
 * Historically a user could have TWO competing macro targets: the daily
 * Calorie-Tracker target (`NutritionTarget`, what drives the dashboard rings on
 * /today and /nutrition) and a meal plan's own embedded target snapshot. They
 * could drift (tracker 200C vs plan 190C), and Chad could build a plan whose
 * target never showed up in the tracker at all.
 *
 * `reconcilePlanTarget` collapses them into one object every time a plan is
 * built: the user's explicit daily-target values win, the plan fills any gaps,
 * and the merged result is written back to the daily target AND returned so the
 * caller snapshots the SAME numbers on the plan. After a build,
 * `NutritionTarget == mealPlan.target` — the rings, the /today card, and the
 * plan view can no longer disagree.
 */

import { upsertNutritionTarget } from "@/lib/db/queries";
import type { NutritionTarget } from "@/lib/db/schema";
import type { MacroTarget } from "@/lib/validation/meal-plan";

/**
 * Merge a freshly-built plan's target with the user's daily target and persist
 * the result as the single daily target.
 *
 * - No daily target set yet → the plan's target becomes the daily target (so the
 *   rings light up and match the plan the user was just handed).
 * - A daily target already set → those explicit numbers win; the plan only fills
 *   any macros the user hadn't specified.
 *
 * @returns the merged target to snapshot on the `MealPlan` row.
 */
export async function reconcilePlanTarget(
  userId: string,
  existing: NutritionTarget | undefined,
  planTarget: MacroTarget
): Promise<MacroTarget> {
  // Explicit user values win; the plan fills any gaps.
  const merged: MacroTarget = {
    calories: existing?.calories ?? planTarget.calories,
    protein: existing?.protein ?? planTarget.protein,
    carbs: existing?.carbs ?? planTarget.carbs,
    fat: existing?.fat ?? planTarget.fat,
  };

  // Persist so the daily Calorie Tracker and the plan share one set of numbers.
  await upsertNutritionTarget(userId, merged);

  return merged;
}
