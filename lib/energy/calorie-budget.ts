/**
 * Calories-burned Phase 3: the day's calorie budget with exercise add-back
 * (D2, default ON with a settings toggle):
 *
 *   budget    = target + credited exercise
 *   remaining = budget − food          (Remaining = Target − Food + Exercise)
 *
 * ONE symbol for the adjusted ring math, shared by the /nutrition dial, the
 * /home panel (arc, week dots, status strip), and anything later — so no
 * two surfaces can disagree about what "remaining" means. Exercise numbers
 * arrive from lib/energy/workout-energy.ts (estimates, labeled estimated at
 * display time); with the toggle off, or no computable exercise, the math
 * reverts to plain Target − Food.
 *
 * Pure math, no DB, no Date.now().
 */

export type CalorieBudgetInput = {
  /** The day's effective-dated calorie target; null = no target set. */
  targetKcal: number | null;
  /** The day's computable exercise estimate; null = none logged/computable. */
  exerciseKcal: number | null;
  /** User.exerciseCalorieAddBack (D2). */
  addBackOn: boolean;
};

export type CalorieBudget = {
  /** Exercise kcal actually added to the budget (0 when off, none, or no
   * target to add onto). */
  credited: number;
  /** target + credited; null when no target is set. */
  budget: number | null;
};

export function calorieBudget(input: CalorieBudgetInput): CalorieBudget {
  const { targetKcal, exerciseKcal, addBackOn } = input;
  if (targetKcal == null || targetKcal <= 0) {
    return { credited: 0, budget: null };
  }
  const credited =
    addBackOn && exerciseKcal != null && Number.isFinite(exerciseKcal)
      ? Math.max(0, Math.round(exerciseKcal))
      : 0;
  return { credited, budget: targetKcal + credited };
}

/** budget − food, the number the ring centers show. Null without a target. */
export function remainingKcal(
  budget: number | null,
  foodKcal: number
): number | null {
  return budget == null ? null : budget - foodKcal;
}
