/**
 * Calories-burned Phase 2 — the "Recommended for you" number in the target
 * editor, with the owner's precedence rule embedded (plan §4.1, D1): once
 * the adaptive engine has enough honest data (its existing ≥10 logged days +
 * ≥4 weigh-ins gates, via observedEnergyBalance), its OBSERVED expenditure
 * outranks the Mifflin-St Jeor formula; the formula is the day-0/no-data
 * fallback. When the formula path is missing profile inputs, the caller gets
 * the exact list to ask for instead of a guess.
 *
 * Pure math, no DB, no Date.now(): the server assembly
 * (lib/nutrition/recommend-target.ts) gathers the member's data, this
 * decides. Unit tests pin the precedence both ways.
 */

import { recommendedTarget } from "@/lib/energy/tdee";
import {
  deriveTargetFromExpenditure,
  desiredRatePerWeek,
  type ObservedEnergyBalance,
  rebalanceMacros,
  type WeightUnit,
} from "@/lib/nutrition/adaptive-target";
import type { ActivityLevel } from "@/lib/profile";

export type MissingRecommendationInput =
  | "activity"
  | "sex"
  | "age"
  | "height"
  | "weight";

export type TargetRecommendationInputs = {
  profile: {
    sex: "male" | "female" | null;
    age: number | null;
    heightCm: number | null;
    activityLevel: ActivityLevel | null;
  };
  /** Latest weigh-in (ProgressEntry) in its stored unit; null = none yet. */
  latestWeight: { value: number; unit: WeightUnit } | null;
  /** Active weight goal's target, same unit space as weigh-ins; null = none. */
  goalWeight: number | null;
  /** The member's current daily target row; null = no target yet. */
  currentTarget: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  } | null;
  /** The adaptive engine's observed balance; null = its gates didn't pass. */
  observed: ObservedEnergyBalance | null;
};

export type TargetRecommendation =
  | {
      kind: "missing";
      /** Formula inputs to ask for, in ask order. Never empty. */
      missing: MissingRecommendationInput[];
    }
  | {
      kind: "ready";
      /** "logs" = adaptive expenditure (outranks); "stats" = the formula. */
      basis: "logs" | "stats";
      /** Estimated daily burn: observed expenditure or formula maintenance. */
      burnPerDay: number;
      /** The recommended daily calorie target (nearest 25, floored). */
      target: number;
      /** Pace the target aims for, unit/week, signed; 0 = maintenance. */
      desiredRate: number;
      unit: WeightUnit;
      /** True when a calorie floor overrode the arithmetic. */
      floored: boolean;
      /** Macros an accept writes (protein anchored); null = calories only. */
      protein: number | null;
      carbs: number | null;
      fat: number | null;
      /** The recommendation equals the member's current calorie target. */
      matchesCurrent: boolean;
    };

const round1 = (n: number) => Math.round(n * 10) / 10;

const usable = (n: number | null): n is number =>
  n != null && Number.isFinite(n) && n > 0;

export function recommendTargetForUser(
  inputs: TargetRecommendationInputs
): TargetRecommendation {
  const currentCalories = inputs.currentTarget?.calories ?? null;

  // Precedence (D1): observed expenditure first. It needs no profile at all,
  // so nothing is asked for that the recommendation doesn't actually need.
  if (inputs.observed) {
    const { unit, expenditure, trendWeight } = inputs.observed;
    const desiredRate = desiredRatePerWeek(
      trendWeight,
      inputs.goalWeight,
      unit
    );
    const derived = deriveTargetFromExpenditure({
      expenditure,
      desiredRate,
      unit,
      currentCalories,
      target: inputs.currentTarget,
    });
    return {
      kind: "ready",
      basis: "logs",
      burnPerDay: expenditure,
      target: derived.calories,
      desiredRate: round1(desiredRate),
      unit,
      floored: derived.floored,
      protein: derived.protein,
      carbs: derived.carbs,
      fat: derived.fat,
      matchesCurrent: derived.calories === currentCalories,
    };
  }

  // Day-0 fallback: the Mifflin-St Jeor formula. Ask for what's missing
  // instead of hiding (or guessing).
  const missing: MissingRecommendationInput[] = [];
  if (inputs.profile.activityLevel == null) {
    missing.push("activity");
  }
  if (inputs.profile.sex == null) {
    missing.push("sex");
  }
  if (!usable(inputs.profile.age)) {
    missing.push("age");
  }
  if (!usable(inputs.profile.heightCm)) {
    missing.push("height");
  }
  const { latestWeight } = inputs;
  if (latestWeight == null || !usable(latestWeight.value)) {
    missing.push("weight");
  }
  // The null re-check is for narrowing only: it always rides with "weight"
  // already in the list, so `missing` is never empty here.
  if (missing.length > 0 || latestWeight == null) {
    return { kind: "missing", missing };
  }

  const unit = latestWeight.unit;
  const desiredRate = desiredRatePerWeek(
    latestWeight.value,
    inputs.goalWeight,
    unit
  );
  const rec = recommendedTarget({
    sex: inputs.profile.sex,
    age: inputs.profile.age,
    heightCm: inputs.profile.heightCm,
    activityLevel: inputs.profile.activityLevel,
    latestWeight,
    goalRate: desiredRate === 0 ? null : { perWeek: desiredRate, unit },
  });
  if (rec == null) {
    // Unreachable: every input was just checked usable.
    throw new Error("recommendedTarget returned null for complete inputs");
  }
  return {
    kind: "ready",
    basis: "stats",
    burnPerDay: rec.maintenance,
    target: rec.target,
    desiredRate: round1(desiredRate),
    unit,
    floored: rec.floored,
    ...rebalanceMacros(rec.target, inputs.currentTarget),
    matchesCurrent: rec.target === currentCalories,
  };
}
