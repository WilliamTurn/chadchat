import { type Macros, scaleMacros, sumMacros } from "@/lib/nutrition/macros";
import type { MacroTarget, PlanDay } from "@/lib/validation/meal-plan";

// --- Portion calibration (LC-1 + FN-3) ---
// The design model portions foods blind (the real macros only exist after
// enrichment), so raw day totals routinely land 5-15% off the target the plan
// itself calls non-negotiable (the audited plan promised 200g protein and
// delivered 172g; every audited day sat 300-550 kcal under its own calorie
// number). Per-100g macros are stored on every matched food, so the gap
// closes deterministically in code with the same offline re-scale the plan
// editor uses. No model involvement. Pure module (no server-only) so the
// unit tests can pin the math.

// How far a day may miss a macro before we adjust portions (3%).
const CALIBRATE_TOLERANCE = 0.03;
// Macros interact (chicken carries fat, rice carries protein), so the
// per-macro passes need a few rounds to settle. One extra round over the
// original three because the FN-3 calorie pass below can nudge macros that
// then need re-fixing.
const CALIBRATE_ROUNDS = 4;
// A food's grams never move more than this from the model's chosen portion,
// so plates stay realistic: calibration trims and tops up, it doesn't invent
// a different meal.
const MIN_PORTION_SCALE = 0.5;
const MAX_PORTION_SCALE = 1.75;

type MacroKey = "protein" | "carbs" | "fat";
const MACRO_KEYS: MacroKey[] = ["protein", "carbs", "fat"];

/** Which macro contributes the most calories per 100g of this food. */
function dominantMacro(per100g: Macros): MacroKey {
  const kcal: Record<MacroKey, number> = {
    protein: per100g.protein * 4,
    carbs: per100g.carbs * 4,
    fat: per100g.fat * 9,
  };
  let best: MacroKey = "protein";
  for (const key of MACRO_KEYS) {
    if (kcal[key] > kcal[best]) {
      best = key;
    }
  }
  return best;
}

/** Clamp a calibrated portion to a realistic multiple of the model's choice. */
function clampPortion(originalGrams: number, nextGrams: number): number {
  const clamped = Math.min(
    originalGrams * MAX_PORTION_SCALE,
    Math.max(originalGrams * MIN_PORTION_SCALE, nextGrams)
  );
  // Round to 5g steps; nobody weighs 172g of rice.
  return Math.max(5, Math.round(clamped / 5) * 5);
}

/**
 * Nudge one day's gram portions until its totals land within tolerance of the
 * macro target: for each macro, scale the foods dominated by that macro toward
 * the gap, clamped to realistic portions, over a few settling rounds. A final
 * per-round CALORIE pass (FN-3) scales every food toward the stated calorie
 * number itself — database calories aren't exactly 4P+4C+9F, so a day can hit
 * the macro grams and still sit visibly under the calorie target the plan
 * promises.
 */
export function calibrateDay(day: PlanDay, target: MacroTarget): PlanDay {
  if (!(target.protein && target.carbs && target.fat)) {
    return day;
  }

  type Adjustable = {
    mealIdx: number;
    foodIdx: number;
    originalGrams: number;
    grams: number;
    per100g: Macros;
    dominant: MacroKey;
  };
  const adjustables: Adjustable[] = [];
  day.meals.forEach((meal, mealIdx) => {
    meal.foods.forEach((food, foodIdx) => {
      if (food.per100g && food.grams > 0) {
        adjustables.push({
          mealIdx,
          foodIdx,
          originalGrams: food.grams,
          grams: food.grams,
          per100g: food.per100g,
          dominant: dominantMacro(food.per100g),
        });
      }
    });
  });
  if (adjustables.length === 0) {
    return day;
  }

  // Unmatched foods carry zero macros, so the adjustables ARE the day's totals.
  for (let round = 0; round < CALIBRATE_ROUNDS; round++) {
    const totals = sumMacros(
      adjustables.map((a) => scaleMacros(a.per100g, a.grams))
    );
    let adjusted = false;
    for (const key of MACRO_KEYS) {
      const want = target[key];
      if (!want) {
        continue;
      }
      const gap = want - totals[key];
      if (Math.abs(gap) <= want * CALIBRATE_TOLERANCE) {
        continue;
      }
      const pool = adjustables.filter((a) => a.dominant === key);
      const poolAmount = pool.reduce(
        (sum, a) => sum + (a.per100g[key] * a.grams) / 100,
        0
      );
      if (poolAmount <= 0) {
        continue;
      }
      const factor = (poolAmount + gap) / poolAmount;
      for (const a of pool) {
        const next = clampPortion(a.originalGrams, a.grams * factor);
        if (next !== a.grams) {
          a.grams = next;
          adjusted = true;
        }
      }
    }

    // FN-3: after the macro passes, close the CALORIE gap directly — it's the
    // headline number the plan page judges each day by. All foods scale
    // proportionally (clamped), so the plate stays the same plate.
    if (target.calories) {
      const now = sumMacros(
        adjustables.map((a) => scaleMacros(a.per100g, a.grams))
      );
      const calGap = target.calories - now.calories;
      if (
        Math.abs(calGap) > target.calories * CALIBRATE_TOLERANCE &&
        now.calories > 0
      ) {
        const factor = (now.calories + calGap) / now.calories;
        for (const a of adjustables) {
          const next = clampPortion(a.originalGrams, a.grams * factor);
          if (next !== a.grams) {
            a.grams = next;
            adjusted = true;
          }
        }
      }
    }

    if (!adjusted) {
      break;
    }
  }

  const byRef = new Map(
    adjustables.map((a) => [`${a.mealIdx}:${a.foodIdx}`, a])
  );
  const meals = day.meals.map((meal, mealIdx) => {
    const foods = meal.foods.map((food, foodIdx) => {
      const adj = byRef.get(`${mealIdx}:${foodIdx}`);
      if (!adj || adj.grams === food.grams) {
        return food;
      }
      return { ...food, grams: adj.grams, ...scaleMacros(adj.per100g, adj.grams) };
    });
    return { ...meal, foods, totals: sumMacros(foods) };
  });
  return { ...day, meals, totals: sumMacros(meals.map((m) => m.totals)) };
}
