// FN-3 regression test. Run with: pnpm test:unit
//
// The audited meal plan promised 2,300 kcal / 190g protein and delivered
// days at 1,737-1,965 kcal (75-85%). These tests pin the calibrator: a day
// designed well under its own target must come out within tolerance on
// CALORIES (the headline number the plan page judges each day by), not just
// on the macro grams.

import assert from "node:assert/strict";
import { test } from "node:test";
import { calibrateDay } from "../../lib/nutrition/plan-calibrate";
import type { PlanDay } from "../../lib/validation/meal-plan";

type Per100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function food(name: string, grams: number, per100g: Per100g) {
  return {
    name,
    grams,
    calories: (per100g.calories * grams) / 100,
    protein: (per100g.protein * grams) / 100,
    carbs: (per100g.carbs * grams) / 100,
    fat: (per100g.fat * grams) / 100,
    fdcId: null,
    fdcDescription: null,
    per100g,
  };
}

// Real-ish per-100g rows (cooked weights). Note the DB calories deliberately
// aren't exactly 4P+4C+9F, like real USDA rows.
const CHICKEN = { calories: 165, protein: 31, carbs: 0, fat: 3.6 };
const RICE = { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 };
const OATS = { calories: 379, protein: 13, carbs: 67, fat: 6.5 };
const OIL = { calories: 884, protein: 0, carbs: 0, fat: 100 };
const YOGURT = { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 };

function mealsTotal(day: PlanDay) {
  return day.totals;
}

/** A day portioned ~25% under a 2,300 kcal / 190P / 205C / 70F target. */
function undershootDay(): PlanDay {
  const meals = [
    {
      slot: "breakfast" as const,
      title: "Oats and yogurt",
      foods: [food("Rolled oats", 70, OATS), food("Greek yogurt", 250, YOGURT)],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    },
    {
      slot: "lunch" as const,
      title: "Chicken and rice",
      foods: [
        food("Chicken breast", 150, CHICKEN),
        food("White rice", 180, RICE),
        food("Olive oil", 10, OIL),
      ],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    },
    {
      slot: "dinner" as const,
      title: "Chicken and rice again",
      foods: [
        food("Chicken breast", 160, CHICKEN),
        food("White rice", 200, RICE),
        food("Olive oil", 12, OIL),
      ],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    },
  ];
  for (const m of meals) {
    m.totals = m.foods.reduce(
      (acc, f) => ({
        calories: acc.calories + f.calories,
        protein: acc.protein + f.protein,
        carbs: acc.carbs + f.carbs,
        fat: acc.fat + f.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }
  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.totals.calories,
      protein: acc.protein + m.totals.protein,
      carbs: acc.carbs + m.totals.carbs,
      fat: acc.fat + m.totals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return { label: "Day 1", meals, totals };
}

const TARGET = { calories: 2300, protein: 190, carbs: 205, fat: 70 };

test("an undershooting day is pulled to its own calorie target", () => {
  const day = undershootDay();
  // Sanity: the fixture really does undershoot like the audited plan did.
  assert.ok(day.totals.calories < TARGET.calories * 0.85);

  const out = calibrateDay(day, TARGET);
  const t = mealsTotal(out);
  // Within 5% of the stated calories (calibration tolerance is 3%, plus 5g
  // rounding slack across foods).
  assert.ok(
    Math.abs(t.calories - TARGET.calories) <= TARGET.calories * 0.05,
    `calories ${t.calories} should land within 5% of ${TARGET.calories}`
  );
  // Protein lands close too — never sacrificed to hit calories.
  assert.ok(
    t.protein >= TARGET.protein * 0.92,
    `protein ${t.protein} should stay near ${TARGET.protein}`
  );
});

test("portions stay realistic: no food moves beyond 0.5x-1.75x", () => {
  const day = undershootDay();
  const out = calibrateDay(day, TARGET);
  out.meals.forEach((meal, mi) => {
    meal.foods.forEach((f, fi) => {
      const orig = day.meals[mi].foods[fi].grams;
      assert.ok(
        f.grams >= orig * 0.5 - 3 && f.grams <= orig * 1.75 + 3,
        `${f.name}: ${orig}g -> ${f.grams}g outside the realistic clamp`
      );
    });
  });
});

test("a day already on target is left alone", () => {
  const day = undershootDay();
  const onTarget = calibrateDay(day, TARGET);
  const again = calibrateDay(onTarget, {
    calories: Math.round(onTarget.totals.calories),
    protein: Math.round(onTarget.totals.protein),
    carbs: Math.round(onTarget.totals.carbs),
    fat: Math.round(onTarget.totals.fat),
  });
  assert.equal(
    Math.round(again.totals.calories),
    Math.round(onTarget.totals.calories)
  );
});

test("a target without full macros is a no-op", () => {
  const day = undershootDay();
  const out = calibrateDay(day, {
    calories: 2300,
    protein: null,
    carbs: 205,
    fat: 70,
  });
  assert.deepEqual(out.totals, day.totals);
});
