import "server-only";

import { todayAnchorInTz, todayStartInTz } from "@/lib/date";
import {
  getActiveGoalsByUserId,
  getMealsBetween,
  getNutritionTarget,
  getProgressEntriesByUserId,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import {
  type AdaptiveResult,
  computeAdaptiveTarget,
  WINDOW_DAYS,
} from "@/lib/nutrition/adaptive-target";
import { dailyMacroTrend } from "@/lib/nutrition/daily-macros";
import { MS_PER_DAY } from "@/lib/chart/trend";

/**
 * NUT-23 — assemble one member's real logged data into the pure adaptive-
 * target engine. Shared by the /nutrition recalibration card, the apply
 * action (which recomputes here rather than trusting client numbers), and
 * the weekly report (where Chad narrates the same numbers).
 *
 * Weekly cadence without a new table: once the member's target was updated —
 * by applying a recalibration, editing targets by hand, or building a meal
 * plan — the engine holds for `COOLDOWN_DAYS` before it will recommend again,
 * so the card can't nag daily about a number the member just chose.
 */

const COOLDOWN_DAYS = 5;

export type UserRecalibration = AdaptiveResult | { kind: "cooldown" };

export async function computeUserRecalibration(
  user: User
): Promise<UserRecalibration> {
  const target = await getNutritionTarget(user.id);
  if (target?.calories == null) {
    return { kind: "insufficient", reason: "no_calorie_target" };
  }

  const now = new Date();
  if (
    target.updatedAt &&
    now.getTime() - target.updatedAt.getTime() < COOLDOWN_DAYS * MS_PER_DAY
  ) {
    return { kind: "cooldown" };
  }

  // Intake window: the member's last WINDOW_DAYS full local days, today
  // excluded (it's still being eaten).
  const todayStart = todayStartInTz(user.timezone);
  const windowStart = new Date(
    todayStart.getTime() - WINDOW_DAYS * MS_PER_DAY
  );

  const [meals, weighIns, goals] = await Promise.all([
    getMealsBetween(user.id, windowStart, todayStart),
    getProgressEntriesByUserId(user.id),
    getActiveGoalsByUserId(user.id),
  ]);

  const goalWeight =
    goals.find((g) => g.metric === "weight" && g.targetValue != null)
      ?.targetValue ?? null;

  const nowAnchor = todayAnchorInTz(user.timezone).getTime();

  return computeAdaptiveTarget({
    weighIns: weighIns
      .filter((e): e is typeof e & { weight: number } => e.weight != null)
      .map((e) => ({
        t: e.recordedAt.getTime(),
        weight: e.weight,
        unit: e.unit === "kg" ? "kg" : "lb",
      })),
    intakeDays: dailyMacroTrend(meals, user.timezone).map((d) => ({
      t: d.t,
      calories: d.calories,
    })),
    nowMs: nowAnchor,
    target: {
      calories: target.calories,
      protein: target.protein,
      carbs: target.carbs,
      fat: target.fat,
    },
    goalWeight,
  });
}
