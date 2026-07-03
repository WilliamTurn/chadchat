// FN-1 portion math. Run with: pnpm test:unit
//
// The Search tab's promise is "the macros you preview are exactly the macros
// that land in your diary". Both sides call `portionMacros`, so these tests
// pin that shared arithmetic: grams and ounces scale per-100g data, servings
// scale the labeled serving, and units a food lacks data for return null
// instead of a wrong number.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type FoodHit,
  portionLabel,
  portionMacros,
} from "../../lib/nutrition/food-hit";

// Chicken breast, the curated-table archetype: per-100g only, no serving.
const CHICKEN: FoodHit = {
  id: "table:chicken breast",
  name: "Chicken breast",
  brand: null,
  per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  serving: null,
  source: "table",
};

// A branded shake: per-100g AND a labeled 340 g serving.
const SHAKE: FoodHit = {
  id: "fdc:123",
  name: "Protein Shake",
  brand: "Fairlife",
  per100g: { calories: 44, protein: 8.8, carbs: 2.4, fat: 0.7 },
  serving: {
    label: "1 bottle (340 g)",
    grams: 340,
    macros: { calories: 150, protein: 30, carbs: 8, fat: 2.5 },
  },
  source: "usda",
};

// A barcode product that only publishes per-serving data (no gram weight
// known for 100 g scaling).
const SERVING_ONLY: FoodHit = {
  id: "off:0000",
  name: "Mystery Bar",
  brand: null,
  per100g: null,
  serving: {
    label: "1 bar",
    grams: null,
    macros: { calories: 200, protein: 10, carbs: 22, fat: 8 },
  },
  source: "off",
};

test("grams scale per-100g data exactly (the tester's 170g chicken breast)", () => {
  assert.deepEqual(portionMacros(CHICKEN, 170, "g"), {
    calories: 281, // 165 * 1.7 = 280.5 -> 281
    protein: 53, // 31 * 1.7 = 52.7 -> 53
    carbs: 0,
    fat: 6, // 3.6 * 1.7 = 6.12 -> 6
  });
});

test("ounces convert at 28.3495 g/oz before scaling", () => {
  // 6 oz = 170.097 g -> same plate as above.
  assert.deepEqual(portionMacros(CHICKEN, 6, "oz"), {
    calories: 281,
    protein: 53,
    carbs: 0,
    fat: 6,
  });
});

test("servings multiply the labeled serving's macros", () => {
  assert.deepEqual(portionMacros(SHAKE, 2, "serving"), {
    calories: 300,
    protein: 60,
    carbs: 16,
    fat: 5,
  });
  // Half servings work too.
  assert.deepEqual(portionMacros(SHAKE, 0.5, "serving"), {
    calories: 75,
    protein: 15,
    carbs: 4,
    fat: 1, // 1.25 -> 1
  });
});

test("a unit the food lacks data for returns null, never a guess", () => {
  // No labeled serving -> servings unavailable.
  assert.equal(portionMacros(CHICKEN, 1, "serving"), null);
  // No per-100g -> grams and ounces unavailable.
  assert.equal(portionMacros(SERVING_ONLY, 100, "g"), null);
  assert.equal(portionMacros(SERVING_ONLY, 4, "oz"), null);
  // But its own serving unit works.
  assert.deepEqual(portionMacros(SERVING_ONLY, 1, "serving"), {
    calories: 200,
    protein: 10,
    carbs: 22,
    fat: 8,
  });
});

test("unusable amounts return null", () => {
  assert.equal(portionMacros(CHICKEN, 0, "g"), null);
  assert.equal(portionMacros(CHICKEN, -5, "g"), null);
  assert.equal(portionMacros(CHICKEN, Number.NaN, "g"), null);
});

test("portionLabel reads naturally in the diary title", () => {
  assert.equal(portionLabel(170, "g"), "170 g");
  assert.equal(portionLabel(6, "oz"), "6 oz");
  assert.equal(portionLabel(1, "serving"), "1 serving");
  assert.equal(portionLabel(2, "serving"), "2 servings");
});
