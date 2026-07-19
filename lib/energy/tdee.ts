/**
 * Calories-burned Phase 1: maintenance calories (TDEE) and the recommended
 * daily target, per plan §4.1 — MyFitnessPal's mechanism with the owner's
 * rulings embedded:
 *
 *   Maintenance = Mifflin-St Jeor BMR × activity multiplier
 *   Recommended target = Maintenance ± (weekly weight goal × kcal-per-unit ÷ 7)
 *   Floors: never below 1500 kcal/day (male) / 1200 (female)
 *
 * The activity multiplier describes everyday life EXCLUDING intentional
 * workouts (MFP semantics) — logged exercise is credited separately via
 * net METs in lib/energy/workout-energy.ts (D3), and once the adaptive
 * engine (lib/nutrition/adaptive-target.ts) has its 10-days/4-weigh-ins of
 * data, its observed expenditure OUTRANKS this formula in recommendations
 * (plan §4.1 precedence rule; the formula is the day-0/no-data fallback).
 *
 * Pure math, no DB, no Date.now(). Missing inputs return null — never guess.
 */

import { lbToKg } from "@/lib/contracts/units";
import { type BmrInputs, mifflinStJeor, type Sex } from "@/lib/energy/bmr";

/** Matches the User.activityLevel enum (migration 0040). Null = not asked. */
export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "very",
] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/**
 * The standard Mifflin/MFP everyday-life multipliers:
 * sedentary 1.2 | lightly active 1.375 | active 1.55 | very active 1.725.
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

export type WeightUnit = "lb" | "kg";

/** Energy density of a unit of bodyweight change (same constants as the
 * adaptive engine's KCAL_PER_UNIT — one physics, two modules). */
export const KCAL_PER_UNIT: Record<WeightUnit, number> = {
  lb: 3500,
  kg: 7700,
};

/** Never recommend below these, whatever the arithmetic says (plan §4.1). */
export const CALORIE_FLOOR: Record<Sex, number> = {
  male: 1500,
  female: 1200,
};

const round25 = (n: number) => Math.round(n / 25) * 25;

export type MaintenanceInputs = BmrInputs & {
  activityLevel: ActivityLevel | null;
};

/**
 * Maintenance calories (TDEE): BMR × activity multiplier, rounded to the
 * nearest kcal. Null when the profile is incomplete.
 */
export function maintenanceKcal(inputs: MaintenanceInputs): number | null {
  const bmr = mifflinStJeor(inputs);
  if (bmr == null || inputs.activityLevel == null) {
    return null;
  }
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[inputs.activityLevel]);
}

/** The member's chosen pace: signed units per week (negative = lose). */
export type GoalRate = { perWeek: number; unit: WeightUnit };

export type RecommendedTargetInputs = {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  /** Latest weigh-in in its stored unit (ProgressEntry); null = none yet. */
  latestWeight: { value: number; unit: WeightUnit } | null;
  /** Null = maintenance (no rate adjustment). */
  goalRate: GoalRate | null;
};

export type RecommendedTarget = {
  /** Unrounded Mifflin-St Jeor BMR, kcal/day. */
  bmr: number;
  /** Maintenance (TDEE), kcal/day. */
  maintenance: number;
  /** The recommended daily calorie target, kcal (nearest 25, floored). */
  target: number;
  /** The daily kcal adjustment the goal rate mapped to (signed). */
  rateAdjustment: number;
  /** True when the sex-specific floor overrode the arithmetic. */
  floored: boolean;
};

/**
 * The day-0 formula recommendation: maintenance ± rate adjustment, rounded
 * to the nearest 25 kcal (the adaptive engine's convention), floored at
 * 1500/1200 by sex. Null when any required profile input is missing — the
 * Phase 2 UI asks for what's missing instead of guessing.
 */
export function recommendedTarget(
  inputs: RecommendedTargetInputs
): RecommendedTarget | null {
  const { latestWeight } = inputs;
  if (latestWeight == null || !Number.isFinite(latestWeight.value)) {
    return null;
  }
  const weightKg =
    latestWeight.unit === "kg"
      ? latestWeight.value
      : lbToKg(latestWeight.value);
  const bmr = mifflinStJeor({ ...inputs, weightKg });
  const maintenance = maintenanceKcal({ ...inputs, weightKg });
  if (bmr == null || maintenance == null || inputs.sex == null) {
    return null;
  }
  const rate = inputs.goalRate;
  const rateAdjustment =
    rate == null || !Number.isFinite(rate.perWeek)
      ? 0
      : Math.round((rate.perWeek * KCAL_PER_UNIT[rate.unit]) / 7);
  const floor = CALORIE_FLOOR[inputs.sex];
  const unfloored = round25(maintenance + rateAdjustment);
  const target = Math.max(floor, unfloored);
  return {
    bmr,
    maintenance,
    target,
    rateAdjustment,
    floored: target > unfloored,
  };
}
