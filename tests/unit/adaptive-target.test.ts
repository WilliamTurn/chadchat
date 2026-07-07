// NUT-23 regression tests. Run with: pnpm test:unit
//
// Pins the adaptive-target engine: energy balance from logged intake + the
// EMA weight trend, a target nudge toward the goal pace, protein anchored,
// and — just as important — every refusal path. A wrong recommendation here
// writes a wrong number into a member's daily targets, so the guardrails ARE
// the feature.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type AdaptiveTargetInputs,
  computeAdaptiveTarget,
  desiredRatePerWeek,
  WINDOW_DAYS,
} from "../../lib/nutrition/adaptive-target";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 7); // Jul 7 2026, a day anchor

/** Daily weigh-ins ending yesterday, moving linearly by `ratePerWeek`. */
function weighIns(opts: {
  start: number;
  days: number;
  ratePerWeek: number;
  unit?: "lb" | "kg";
}): AdaptiveTargetInputs["weighIns"] {
  const rows: AdaptiveTargetInputs["weighIns"] = [];
  for (let i = 0; i < opts.days; i++) {
    const t = NOW - (opts.days - i) * DAY;
    rows.push({
      t,
      weight: opts.start + (opts.ratePerWeek * i) / 7,
      unit: opts.unit ?? "lb",
    });
  }
  return rows;
}

/** `days` fully-logged days ending yesterday at `calories` each. */
function intake(
  days: number,
  calories: number
): AdaptiveTargetInputs["intakeDays"] {
  return Array.from({ length: days }, (_, i) => ({
    t: NOW - (days - i) * DAY,
    calories,
  }));
}

const FULL_TARGET = { calories: 2300, protein: 190, carbs: 205, fat: 70 };

function inputs(
  over: Partial<AdaptiveTargetInputs> = {}
): AdaptiveTargetInputs {
  return {
    // 6 weeks of daily weigh-ins losing 1 lb/week, from 215 lb
    weighIns: weighIns({ start: 215, days: 42, ratePerWeek: -1 }),
    intakeDays: intake(WINDOW_DAYS, 2300),
    nowMs: NOW,
    target: { ...FULL_TARGET },
    goalWeight: 195,
    ...over,
  };
}

test("losing slower than the goal pace cuts calories", () => {
  // Eating 2,300, trend falling ~1 lb/wk → expenditure ≈ 2,800. Goal pace for
  // a ~209 lb member is the 0.75%/wk default ≈ 1.6 lb/wk → ideal ≈ 2,020,
  // clamped to the 150 kcal step → 2,150.
  const res = computeAdaptiveTarget(inputs());
  assert.equal(res.kind, "recommend");
  if (res.kind !== "recommend") {
    return;
  }
  assert.equal(res.calories, 2150);
  assert.equal(res.deltaCalories, -150);
  assert.ok(Math.abs(res.expenditure - 2800) <= 25, `expenditure ${res.expenditure}`);
  // Protein anchored; carbs+fat absorb the cut in ratio.
  assert.equal(res.protein, 190);
  assert.ok(res.carbs != null && res.carbs < FULL_TARGET.carbs);
  assert.ok(res.fat != null && res.fat < FULL_TARGET.fat);
  // The macro equation still holds within rounding.
  const macroCal = 190 * 4 + (res.carbs ?? 0) * 4 + (res.fat ?? 0) * 9;
  assert.ok(Math.abs(macroCal - res.calories) <= 15, `macros add to ${macroCal}`);
});

test("losing too fast at maintenance-distance raises calories", () => {
  // No weight goal → maintenance pace, but the trend is falling 2 lb/wk on
  // 2,000 kcal: expenditure = 3,000, so the target should move UP (step-capped).
  const res = computeAdaptiveTarget(
    inputs({
      weighIns: weighIns({ start: 180, days: 42, ratePerWeek: -2 }),
      intakeDays: intake(WINDOW_DAYS, 2000),
      target: { calories: 2000, protein: 160, carbs: 180, fat: 60 },
      goalWeight: null,
    })
  );
  assert.equal(res.kind, "recommend");
  if (res.kind !== "recommend") {
    return;
  }
  assert.equal(res.desiredRate, 0);
  assert.equal(res.deltaCalories, 150); // 3,000 ideal, step-capped from 2,000
});

test("on pace already → hold (delta below threshold)", () => {
  // Eating 2,300 and losing ~1.6 lb/wk (the goal pace for ~209 lb):
  // expenditure ≈ 3,100, ideal ≈ 2,300 → delta ~0.
  const res = computeAdaptiveTarget(
    inputs({
      weighIns: weighIns({ start: 215, days: 42, ratePerWeek: -1.6 }),
    })
  );
  assert.equal(res.kind, "hold");
});

test("no calorie target set → insufficient", () => {
  const res = computeAdaptiveTarget(inputs({ target: null }));
  assert.deepEqual(res, {
    kind: "insufficient",
    reason: "no_calorie_target",
  });
});

test("too few fully-logged days → insufficient", () => {
  const res = computeAdaptiveTarget(inputs({ intakeDays: intake(6, 2300) }));
  assert.deepEqual(res, { kind: "insufficient", reason: "few_logged_days" });
});

test("half-logged days (breakfast-only) don't count as logged days", () => {
  // 14 days but 8 of them under the 1,000 kcal floor → 6 honest days → refuse.
  const days = [...intake(8, 650), ...intake(6, 2300)].map((d, i) => ({
    ...d,
    t: NOW - (14 - i) * DAY,
  }));
  const res = computeAdaptiveTarget(inputs({ intakeDays: days }));
  assert.deepEqual(res, { kind: "insufficient", reason: "few_logged_days" });
});

test("stale weigh-ins → insufficient", () => {
  const old = weighIns({ start: 215, days: 42, ratePerWeek: -1 }).map((w) => ({
    ...w,
    t: w.t - 10 * DAY,
  }));
  const res = computeAdaptiveTarget(inputs({ weighIns: old }));
  assert.deepEqual(res, { kind: "insufficient", reason: "stale_weighins" });
});

test("weigh-ins clustered in a few days → insufficient", () => {
  const cluster = [0, 1, 2, 3].map((i) => ({
    t: NOW - (4 - i) * DAY,
    weight: 210,
    unit: "lb" as const,
  }));
  const res = computeAdaptiveTarget(inputs({ weighIns: cluster }));
  assert.deepEqual(res, { kind: "insufficient", reason: "few_weighins" });
});

test("implausible balance (heavy under-logging) → refuse", () => {
  // Claims 1,200 kcal/day while GAINING a pound a week → expenditure ≈ 700,
  // which is nonsense; the honest move is no recommendation.
  const res = computeAdaptiveTarget(
    inputs({
      weighIns: weighIns({ start: 215, days: 42, ratePerWeek: 1 }),
      intakeDays: intake(WINDOW_DAYS, 1200),
    })
  );
  assert.deepEqual(res, {
    kind: "insufficient",
    reason: "implausible_expenditure",
  });
});

test("calorie floor holds whatever the arithmetic says", () => {
  // Tiny member, tiny intake, still losing slowly: ideal lands under 1,200 →
  // floor + step cap keep the recommendation sane.
  const res = computeAdaptiveTarget(
    inputs({
      weighIns: weighIns({ start: 118, days: 42, ratePerWeek: -0.2, unit: "kg" }),
      intakeDays: intake(WINDOW_DAYS, 1300),
      target: { calories: 1300, protein: null, carbs: null, fat: null },
      goalWeight: 100,
    })
  );
  if (res.kind === "recommend") {
    assert.ok(res.calories >= 1200, `floored at ${res.calories}`);
    assert.ok(Math.abs(res.deltaCalories) <= 150);
    // Incomplete macro target → calories move alone.
    assert.equal(res.protein, null);
  } else {
    assert.equal(res.kind, "hold");
  }
});

test("kg units use the 7,700 kcal energy density", () => {
  // 95 kg, losing 0.45 kg/wk on 2,500 kcal → expenditure ≈ 2,500 + 495 ≈
  // 2,995 (the EMA's smoothing lag shaves a few dozen kcal off the ideal).
  const res = computeAdaptiveTarget(
    inputs({
      weighIns: weighIns({ start: 95, days: 42, ratePerWeek: -0.45, unit: "kg" }),
      intakeDays: intake(WINDOW_DAYS, 2500),
      target: { calories: 2500, protein: 170, carbs: 250, fat: 80 },
      goalWeight: 85,
    })
  );
  assert.equal(res.kind, "recommend");
  if (res.kind !== "recommend") {
    return;
  }
  assert.equal(res.unit, "kg");
  assert.ok(Math.abs(res.expenditure - 2995) <= 80, `expenditure ${res.expenditure}`);
});

test("desired pace: cut, gain, at-goal, and no-goal", () => {
  assert.ok(desiredRatePerWeek(210, 195, "lb") < 0);
  assert.ok(desiredRatePerWeek(150, 165, "lb") > 0);
  assert.equal(desiredRatePerWeek(196, 195, "lb"), 0); // within tolerance
  assert.equal(desiredRatePerWeek(210, null, "lb"), 0);
  // Bounds hold: a 300 lb member's cut pace caps at 2 lb/wk.
  assert.equal(desiredRatePerWeek(300, 200, "lb"), -2);
});
