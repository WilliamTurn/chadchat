import "server-only";

import { MS_PER_DAY } from "@/lib/chart/trend";
import { todayAnchorInTz, todayStartInTz } from "@/lib/date";
import {
  getActiveGoalsByUserId,
  getMealsBetween,
  getNutritionTarget,
  getProgressEntriesByUserId,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import {
  observedEnergyBalance,
  WINDOW_DAYS,
} from "@/lib/nutrition/adaptive-target";
import { dailyMacroTrend } from "@/lib/nutrition/daily-macros";
import {
  recommendTargetForUser,
  type TargetRecommendation,
} from "@/lib/nutrition/target-recommendation";

/**
 * Calories-burned Phase 2 — assemble one member's profile + real logs into
 * the pure target-recommendation engine (precedence rule inside: observed
 * expenditure outranks the formula). Shared by the target editor's
 * "Recommended for you" fetch and the accept action, which recomputes here
 * rather than trusting client numbers (the applyRecalibration pattern).
 */
export async function computeUserTargetRecommendation(
  user: User
): Promise<TargetRecommendation> {
  // Intake window mirrors the recalibration card: the member's last
  // WINDOW_DAYS full local days, today excluded (it's still being eaten).
  const todayStart = todayStartInTz(user.timezone);
  const windowStart = new Date(todayStart.getTime() - WINDOW_DAYS * MS_PER_DAY);

  const [target, meals, entries, goals] = await Promise.all([
    getNutritionTarget(user.id),
    getMealsBetween(user.id, windowStart, todayStart),
    getProgressEntriesByUserId(user.id),
    getActiveGoalsByUserId(user.id),
  ]);

  const weighIns = entries
    .filter((e): e is typeof e & { weight: number } => e.weight != null)
    .map((e) => ({
      t: e.recordedAt.getTime(),
      weight: e.weight,
      unit: e.unit === "kg" ? ("kg" as const) : ("lb" as const),
    }));
  const latest = weighIns.at(-1);

  const observed = observedEnergyBalance({
    weighIns,
    intakeDays: dailyMacroTrend(meals, user.timezone).map((d) => ({
      t: d.t,
      calories: d.calories,
    })),
    nowMs: todayAnchorInTz(user.timezone).getTime(),
  });

  const goalWeight =
    goals.find((g) => g.metric === "weight" && g.targetValue != null)
      ?.targetValue ?? null;

  return recommendTargetForUser({
    profile: {
      sex: user.sex,
      age: user.age,
      heightCm: user.heightCm,
      activityLevel: user.activityLevel,
    },
    latestWeight: latest ? { value: latest.weight, unit: latest.unit } : null,
    goalWeight,
    currentTarget: target
      ? {
          calories: target.calories,
          protein: target.protein,
          carbs: target.carbs,
          fat: target.fat,
        }
      : null,
    observed: observed.kind === "ok" ? observed : null,
  });
}
