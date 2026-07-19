/**
 * Calories-burned Phase 1 (owner rulings 2026-07-18, plan
 * calories-burned-plan-2026-07-17.md §4/§6): basal metabolic rate via
 * Mifflin-St Jeor, the equation the mainstream trackers (MyFitnessPal,
 * Lose It!, Cronometer) all build their daily budget on.
 *
 * Pure math, no DB, no Date.now(): results derive only from the passed
 * inputs so unit tests can pin the numbers. Missing or implausible inputs
 * return null — this module never guesses (data-layer honesty).
 */

export type Sex = "male" | "female";

export type BmrInputs = {
  sex: Sex | null;
  /** Age in whole years (User.age). */
  age: number | null;
  /** Height in centimeters (User.heightCm). */
  heightCm: number | null;
  /** Body weight in kilograms (from the latest weigh-in, converted). */
  weightKg: number | null;
};

const isUsable = (n: number | null): n is number =>
  n != null && Number.isFinite(n) && n > 0;

/**
 * Mifflin-St Jeor BMR in kcal/day:
 *   men:   10·kg + 6.25·cm − 5·age + 5
 *   women: 10·kg + 6.25·cm − 5·age − 161
 * Unrounded (callers round at their own display/derivation point).
 * Null when any input is missing or non-positive.
 */
export function mifflinStJeor(inputs: BmrInputs): number | null {
  const { sex, age, heightCm, weightKg } = inputs;
  if (
    sex == null ||
    !isUsable(age) ||
    !isUsable(heightCm) ||
    !isUsable(weightKg)
  ) {
    return null;
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}
