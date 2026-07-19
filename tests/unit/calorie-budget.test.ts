// Calories-burned Phase 3: ring-math regression suite for the add-back
// budget (D2). Pins Remaining = Target − Food + Exercise when the toggle is
// on, and the exact reversion to Target − Food when it is off or nothing is
// computable. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calorieBudget,
  remainingKcal,
} from "../../lib/energy/calorie-budget";

test("add-back on: Remaining = Target − Food + Exercise", () => {
  const { credited, budget } = calorieBudget({
    targetKcal: 2000,
    exerciseKcal: 300,
    addBackOn: true,
  });
  assert.equal(credited, 300);
  assert.equal(budget, 2300);
  assert.equal(remainingKcal(budget, 1800), 500);
});

test("add-back off: the math reverts to plain Target − Food", () => {
  const { credited, budget } = calorieBudget({
    targetKcal: 2000,
    exerciseKcal: 300,
    addBackOn: false,
  });
  assert.equal(credited, 0);
  assert.equal(budget, 2000);
  assert.equal(remainingKcal(budget, 1800), 200);
});

test("no computable exercise (null) credits nothing", () => {
  const { credited, budget } = calorieBudget({
    targetKcal: 2000,
    exerciseKcal: null,
    addBackOn: true,
  });
  assert.equal(credited, 0);
  assert.equal(budget, 2000);
});

test("no target set: no budget, no remaining, nothing credited", () => {
  const { credited, budget } = calorieBudget({
    targetKcal: null,
    exerciseKcal: 300,
    addBackOn: true,
  });
  assert.equal(credited, 0);
  assert.equal(budget, null);
  assert.equal(remainingKcal(budget, 1800), null);
});

test("the over boundary moves WITH the credit", () => {
  const { budget } = calorieBudget({
    targetKcal: 2000,
    exerciseKcal: 300,
    addBackOn: true,
  });
  // 2300 eaten against a 2300 budget is exactly even, not over.
  assert.equal(remainingKcal(budget, 2300), 0);
  assert.equal(remainingKcal(budget, 2301), -1);
});

test("garbage exercise values are guarded, never subtracted or propagated", () => {
  assert.equal(
    calorieBudget({ targetKcal: 2000, exerciseKcal: -50, addBackOn: true })
      .credited,
    0
  );
  assert.equal(
    calorieBudget({
      targetKcal: 2000,
      exerciseKcal: Number.NaN,
      addBackOn: true,
    }).credited,
    0
  );
  // Fractional estimates land as whole kcal.
  assert.equal(
    calorieBudget({ targetKcal: 2000, exerciseKcal: 225.4, addBackOn: true })
      .credited,
    225
  );
});
