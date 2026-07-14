/**
 * Next-planned-meal slice tests (FIX-30, P56-E). The slice must be
 * deterministic, advance the rotation exactly once per member-local day,
 * follow plan order for meal progression, and be safe when data is missing.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MS_PER_DAY, mealSliceToday } from "../../lib/plans/meal-slice";
import type { PlanDays } from "../../lib/validation/meal-plan";

const zeroMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function meal(title: string, slot: "breakfast" | "lunch" | "dinner" | "snack", calories: number, protein: number) {
  return {
    slot,
    title,
    foods: [
      {
        name: title,
        grams: 100,
        calories,
        protein,
        carbs: 0,
        fat: 0,
        fdcId: null,
        fdcDescription: null,
        per100g: null,
      },
    ],
    totals: { calories, protein, carbs: 0, fat: 0 },
  };
}

function day(label: string, meals: ReturnType<typeof meal>[]) {
  return {
    label,
    meals,
    totals: meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.totals.calories,
        protein: acc.protein + m.totals.protein,
        carbs: 0,
        fat: 0,
      }),
      zeroMacros
    ),
  };
}

const DAY0 = 1_750_000_000_000 - (1_750_000_000_000 % MS_PER_DAY);

const threeDays: PlanDays = [
  day("Day 1", [
    meal("Oats & whey", "breakfast", 520, 42),
    meal("Chicken rice bowl", "lunch", 640, 51),
    meal("Salmon & potatoes", "dinner", 700, 45),
  ]),
  day("Day 2", [
    meal("Eggs & toast", "breakfast", 480, 35),
    meal("Turkey wrap", "lunch", 600, 48),
  ]),
  day("Day 3", [meal("Steak & veg", "dinner", 900, 70)]),
];

describe("mealSliceToday", () => {
  it("picks the plan's first meal on the creation day with nothing logged", () => {
    const slice = mealSliceToday({
      days: threeDays,
      planStartDayMs: DAY0,
      todayDayMs: DAY0,
      mealsLoggedToday: 0,
    });
    assert.ok(slice);
    assert.equal(slice.dayIndex, 0);
    assert.equal(slice.nextMeal?.title, "Oats & whey");
    assert.equal(slice.nextMeal?.calories, 520);
    assert.equal(slice.plannedDay.calories, 520 + 640 + 700);
  });

  it("advances the day rotation once per member-local day, modulo length", () => {
    for (const [elapsed, expected] of [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 0],
      [7, 1],
    ] as const) {
      const slice = mealSliceToday({
        days: threeDays,
        planStartDayMs: DAY0,
        todayDayMs: DAY0 + elapsed * MS_PER_DAY,
        mealsLoggedToday: 0,
      });
      assert.equal(slice?.dayIndex, expected, `elapsed=${elapsed}`);
    }
  });

  it("advances the meal by the logged count, in plan order", () => {
    const slice = mealSliceToday({
      days: threeDays,
      planStartDayMs: DAY0,
      todayDayMs: DAY0,
      mealsLoggedToday: 1,
    });
    assert.equal(slice?.nextMeal?.title, "Chicken rice bowl");
    assert.equal(slice?.nextMeal?.position, 1);
    assert.match(slice?.reason ?? "", /logged 1 of 3/);
  });

  it("reports the completed state instead of fabricating a next meal", () => {
    const slice = mealSliceToday({
      days: threeDays,
      planStartDayMs: DAY0,
      todayDayMs: DAY0 + MS_PER_DAY, // Day 2: two meals
      mealsLoggedToday: 2,
    });
    assert.ok(slice);
    assert.equal(slice.nextMeal, null);
    assert.match(slice.reason, /All 2 planned meals/);
  });

  it("keeps the slice stable when more meals are logged than planned", () => {
    const slice = mealSliceToday({
      days: threeDays,
      planStartDayMs: DAY0,
      todayDayMs: DAY0,
      mealsLoggedToday: 9,
    });
    assert.equal(slice?.nextMeal, null);
  });

  it("is safe when today precedes the plan's creation day (clock skew)", () => {
    const slice = mealSliceToday({
      days: threeDays,
      planStartDayMs: DAY0,
      todayDayMs: DAY0 - 2 * MS_PER_DAY,
      mealsLoggedToday: 0,
    });
    assert.equal(slice?.dayIndex, 0);
  });

  it("returns null for an empty plan", () => {
    assert.equal(
      mealSliceToday({
        days: [] as unknown as PlanDays,
        planStartDayMs: DAY0,
        todayDayMs: DAY0,
        mealsLoggedToday: 0,
      }),
      null
    );
  });

  it("names a single-day plan without rotation phrasing", () => {
    const slice = mealSliceToday({
      days: [threeDays[2]],
      planStartDayMs: DAY0,
      todayDayMs: DAY0 + 5 * MS_PER_DAY,
      mealsLoggedToday: 0,
    });
    assert.equal(slice?.dayIndex, 0);
    assert.doesNotMatch(slice?.reason ?? "", /rotation/);
  });
});
