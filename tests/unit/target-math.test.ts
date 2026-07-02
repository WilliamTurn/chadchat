// R2-3 regression test. Run with: pnpm test:unit
//
// The old TargetEditor accepted any four numbers: 100 calories with 900g
// protein saved fine, though protein alone is 3,600 kcal. These tests pin the
// shared 4/4/9 arithmetic the editor and the save action now both enforce.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calorieTolerance,
  gramsFromSplit,
  macroCalories,
  reconcileTarget,
  splitFromGrams,
} from "../../lib/nutrition/target-math";

test("macroCalories uses 4/4/9 kcal per gram", () => {
  assert.equal(
    macroCalories({ protein: 180, carbs: 250, fat: 70 }),
    180 * 4 + 250 * 4 + 70 * 9 // 2,350
  );
  // Unset fields count as zero.
  assert.equal(macroCalories({ protein: 100, carbs: null, fat: null }), 400);
});

test("the audit's exact nonsense case is impossible", () => {
  // 100 calories with 900g protein: protein alone is 3,600 kcal.
  const v = reconcileTarget(100, { protein: 900, carbs: null, fat: null });
  assert.equal(v.kind, "impossible");
  if (v.kind === "impossible") {
    assert.equal(v.macroCal, 3600);
    assert.equal(v.overBy, 3500);
  }
});

test("a consistent full target matches within tolerance", () => {
  // 2,400 target; macros sum to 2,350 (50 under, tolerance is 72).
  const v = reconcileTarget(2400, { protein: 180, carbs: 250, fat: 70 });
  assert.equal(v.kind, "match");
});

test("a big shortfall warns as under, not impossible", () => {
  // Macros sum to 1,596 against a 2,400 target: ~800 short.
  const v = reconcileTarget(2400, { protein: 150, carbs: 150, fat: 44 });
  assert.equal(v.kind, "under");
});

test("partial macros inside the target are fine", () => {
  // Only protein set: 720 kcal of a 2,000 target. Nothing to warn about.
  const v = reconcileTarget(2000, { protein: 180, carbs: null, fat: null });
  assert.equal(v.kind, "partial");
});

test("macros with no calorie target are informational", () => {
  const v = reconcileTarget(null, { protein: 180, carbs: 250, fat: 70 });
  assert.equal(v.kind, "info");
});

test("no macros means nothing to reconcile", () => {
  assert.equal(
    reconcileTarget(2200, { protein: null, carbs: null, fat: null }).kind,
    "none"
  );
});

test("tolerance is 30 kcal or 3%, whichever is larger", () => {
  assert.equal(calorieTolerance(500), 30);
  assert.equal(calorieTolerance(2400), 72);
});

test("gramsFromSplit derives grams that add back up to the calories", () => {
  // 2,000 cal at 30P/40C/30F: 150g protein, 200g carbs, 67g fat.
  const g = gramsFromSplit(2000, { protein: 30, carbs: 40, fat: 30 });
  assert.deepEqual(g, { protein: 150, carbs: 200, fat: 67 });
  // Re-summing lands within rounding tolerance of the target.
  const back = macroCalories(g);
  assert.ok(Math.abs(back - 2000) <= calorieTolerance(2000));
});

test("splitFromGrams round-trips a split and always totals 100", () => {
  const split = splitFromGrams({ protein: 150, carbs: 200, fat: 67 });
  assert.ok(split);
  if (split) {
    assert.equal(split.protein + split.carbs + split.fat, 100);
    assert.equal(split.protein, 30);
  }
  // Missing grams: no split to derive.
  assert.equal(splitFromGrams({ protein: 150, carbs: null, fat: 67 }), null);
});
