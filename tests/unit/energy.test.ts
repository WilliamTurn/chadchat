// Calories-burned Phase 1 (owner rulings 2026-07-18): the energy engine's
// unit suite. Run with: pnpm test:unit
//
// Pins the plan's golden values (Compendium METs, the 90 kg × 60 min ≈ 225
// net kcal example), the 1500/1200 floors, the rate-adjustment arithmetic,
// missing-data null edges (never guess), the catalog's shape invariants,
// and the machine-cardio library mapping.

import assert from "node:assert/strict";
import { test } from "node:test";
import { METRICS } from "../../lib/contracts/metrics";
import { mifflinStJeor } from "../../lib/energy/bmr";
import {
  ACTIVITY_CATALOG,
  activityForLibraryExercise,
  activityMet,
  findActivity,
  LIBRARY_CARDIO_ACTIVITY_IDS,
} from "../../lib/energy/activity-catalog";
import {
  ACTIVITY_MULTIPLIERS,
  CALORIE_FLOOR,
  KCAL_PER_UNIT,
  maintenanceKcal,
  recommendedTarget,
} from "../../lib/energy/tdee";
import {
  cardioNetKcal,
  exerciseKcalForDay,
  netKcal,
  netKcalPerMinute,
  STRENGTH_METS,
  strengthNetKcal,
  workoutNetKcal,
} from "../../lib/energy/workout-energy";
import { findBuiltInExercise } from "../../lib/workouts/exercise-library";

/* ------------------------------------------------------------------ bmr */

const MALE_90KG = {
  sex: "male" as const,
  age: 30,
  heightCm: 180,
  weightKg: 90,
};

test("Mifflin-St Jeor golden values", () => {
  // men: 10·kg + 6.25·cm − 5·age + 5 → 900 + 1125 − 150 + 5
  assert.equal(mifflinStJeor(MALE_90KG), 1880);
  // women: 10·kg + 6.25·cm − 5·age − 161 → 700 + 1031.25 − 200 − 161
  assert.equal(
    mifflinStJeor({ sex: "female", age: 40, heightCm: 165, weightKg: 70 }),
    1370.25
  );
});

test("BMR returns null on any missing or implausible input", () => {
  assert.equal(mifflinStJeor({ ...MALE_90KG, sex: null }), null);
  assert.equal(mifflinStJeor({ ...MALE_90KG, age: null }), null);
  assert.equal(mifflinStJeor({ ...MALE_90KG, heightCm: null }), null);
  assert.equal(mifflinStJeor({ ...MALE_90KG, weightKg: null }), null);
  assert.equal(mifflinStJeor({ ...MALE_90KG, age: 0 }), null);
  assert.equal(mifflinStJeor({ ...MALE_90KG, weightKg: -80 }), null);
  assert.equal(
    mifflinStJeor({ ...MALE_90KG, heightCm: Number.NaN }),
    null
  );
});

/* ----------------------------------------------------------------- tdee */

test("the four everyday-life multipliers are the MFP standard", () => {
  assert.deepEqual(ACTIVITY_MULTIPLIERS, {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725,
  });
  assert.deepEqual(KCAL_PER_UNIT, { lb: 3500, kg: 7700 });
});

test("maintenance = BMR × multiplier, rounded", () => {
  // 1880 × 1.55 = 2914
  assert.equal(
    maintenanceKcal({ ...MALE_90KG, activityLevel: "moderate" }),
    2914
  );
  assert.equal(
    maintenanceKcal({ ...MALE_90KG, activityLevel: "sedentary" }),
    2256
  );
  assert.equal(maintenanceKcal({ ...MALE_90KG, activityLevel: null }), null);
});

const PROFILE_90KG = {
  sex: "male" as const,
  age: 30,
  heightCm: 180,
  activityLevel: "moderate" as const,
  latestWeight: { value: 90, unit: "kg" as const },
};

test("recommended target at maintenance (no goal rate)", () => {
  const r = recommendedTarget({ ...PROFILE_90KG, goalRate: null });
  assert.ok(r);
  assert.equal(r.bmr, 1880);
  assert.equal(r.maintenance, 2914);
  assert.equal(r.rateAdjustment, 0);
  assert.equal(r.target, 2925); // nearest 25
  assert.equal(r.floored, false);
});

test("losing 1 lb a week subtracts 500 kcal/day", () => {
  const r = recommendedTarget({
    ...PROFILE_90KG,
    goalRate: { perWeek: -1, unit: "lb" },
  });
  assert.ok(r);
  assert.equal(r.rateAdjustment, -500);
  assert.equal(r.target, 2425); // 2914 − 500 = 2414 → nearest 25
  assert.equal(r.floored, false);
});

test("gaining 0.25 kg a week adds 275 kcal/day", () => {
  const r = recommendedTarget({
    ...PROFILE_90KG,
    goalRate: { perWeek: 0.25, unit: "kg" },
  });
  assert.ok(r);
  assert.equal(r.rateAdjustment, 275); // 7700 × 0.25 ÷ 7
  assert.equal(r.target, 3200); // 2914 + 275 = 3189 → nearest 25
});

test("the female floor holds at 1200 whatever the arithmetic says", () => {
  const r = recommendedTarget({
    sex: "female",
    age: 60,
    heightCm: 150,
    activityLevel: "sedentary",
    latestWeight: { value: 45, unit: "kg" },
    goalRate: { perWeek: -1, unit: "lb" },
  });
  assert.ok(r);
  // BMR 926.5 → maintenance 1112 → −500 = 612, floored up to 1200.
  assert.equal(r.maintenance, 1112);
  assert.equal(r.target, CALORIE_FLOOR.female);
  assert.equal(r.floored, true);
});

test("the male floor holds at 1500", () => {
  const r = recommendedTarget({
    sex: "male",
    age: 70,
    heightCm: 160,
    activityLevel: "sedentary",
    latestWeight: { value: 55, unit: "kg" },
    goalRate: { perWeek: -1, unit: "lb" },
  });
  assert.ok(r);
  // BMR 1205 → maintenance 1446 → −500 = 946, floored up to 1500.
  assert.equal(r.target, CALORIE_FLOOR.male);
  assert.equal(r.floored, true);
});

test("recommendation is null when profile data is missing, never a guess", () => {
  assert.equal(
    recommendedTarget({ ...PROFILE_90KG, goalRate: null, activityLevel: null }),
    null
  );
  assert.equal(
    recommendedTarget({ ...PROFILE_90KG, goalRate: null, sex: null }),
    null
  );
  assert.equal(
    recommendedTarget({ ...PROFILE_90KG, goalRate: null, latestWeight: null }),
    null
  );
});

test("lb weigh-ins convert and land on the same recommendation", () => {
  const fromKg = recommendedTarget({ ...PROFILE_90KG, goalRate: null });
  const fromLb = recommendedTarget({
    ...PROFILE_90KG,
    // 90 kg expressed in lb (2.20462 lb/kg, the app's shared conversion).
    latestWeight: { value: 198.4158, unit: "lb" },
    goalRate: null,
  });
  assert.ok(fromKg && fromLb);
  assert.equal(fromLb.maintenance, fromKg.maintenance);
  assert.equal(fromLb.target, fromKg.target);
});

/* ------------------------------------------------------ activity catalog */

test("the catalog carries ~40 activities with unique ids", () => {
  assert.ok(
    ACTIVITY_CATALOG.length >= 40,
    `expected ~40 activities, have ${ACTIVITY_CATALOG.length}`
  );
  const ids = ACTIVITY_CATALOG.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every MET is a plausible Compendium value; variants are coherent", () => {
  for (const a of ACTIVITY_CATALOG) {
    assert.ok(
      a.met >= 1.5 && a.met <= 15,
      `${a.id}: implausible default MET ${a.met}`
    );
    if (!a.variants) {
      continue;
    }
    assert.ok(a.variants.length > 0, `${a.id}: empty variants`);
    const variantIds = a.variants.map((v) => v.id);
    assert.equal(
      new Set(variantIds).size,
      variantIds.length,
      `${a.id}: duplicate variant ids`
    );
    for (const v of a.variants) {
      assert.ok(
        v.met >= 1.5 && v.met <= 15,
        `${a.id}/${v.id}: implausible MET ${v.met}`
      );
    }
    // The default effort is one of the listed intensities, so the picker's
    // preselected option always shows the same number the default computes.
    assert.ok(
      a.variants.some((v) => v.met === a.met),
      `${a.id}: default MET ${a.met} is not one of its variants`
    );
  }
});

test("the plan's pinned Compendium values are vendored verbatim", () => {
  assert.equal(findActivity("weight-lifting")?.met, 3.5);
  assert.equal(activityMet("weight-lifting", "compound"), 5.0);
  assert.equal(activityMet("weight-lifting", "vigorous"), 6.0);
  assert.equal(findActivity("hiit")?.met, 11.0);
  assert.equal(findActivity("circuit-training")?.met, 8.0);
  assert.equal(findActivity("rowing-machine")?.met, 7.5);
  assert.equal(findActivity("elliptical")?.met, 5.0);
  assert.equal(findActivity("hiking")?.met, 5.3);
  assert.equal(findActivity("jump-rope")?.met, 11.0);
  assert.equal(activityMet("walking", "brisk"), 4.8);
  assert.equal(activityMet("running", "5-mph"), 8.5);
  assert.equal(activityMet("running", "6-mph"), 9.3);
  assert.equal(activityMet("running", "10-mph"), 14.8);
  assert.equal(findActivity("swimming")?.met, 8.0);
  assert.equal(findActivity("basketball")?.met, 7.5);
  assert.equal(findActivity("soccer")?.met, 9.5);
  assert.equal(findActivity("tennis-singles")?.met, 8.0);
  assert.equal(findActivity("cycling")?.met, 8.0);
});

test("unknown activities and variants resolve to null, never a guess", () => {
  assert.equal(activityMet("underwater-basket-weaving"), null);
  assert.equal(activityMet("running", "26-mph"), null);
});

test("all 4 machine-cardio library names map onto the catalog", () => {
  const names = Object.keys(LIBRARY_CARDIO_ACTIVITY_IDS);
  assert.equal(names.length, 4);
  for (const name of names) {
    // The key really is a built-in library exercise, and a cardio one.
    const libraryRow = findBuiltInExercise(name);
    assert.ok(libraryRow, `${name}: not in the built-in exercise library`);
    assert.equal(libraryRow.muscleGroup, "cardio", `${name}: not cardio`);
    // And it resolves to a real catalog activity, case-insensitively.
    const activity = activityForLibraryExercise(name);
    assert.ok(activity, `${name}: no catalog activity`);
    assert.equal(activityForLibraryExercise(name.toLowerCase()), activity);
  }
  assert.equal(activityForLibraryExercise("Bench Press"), undefined);
});

/* -------------------------------------------------------- workout energy */

test("net METs: (MET − 1) × kg × hours, the plan's golden example", () => {
  // 90 kg lifting 60 min at MET 3.5 ≈ 225 net kcal (315 gross — never used).
  assert.equal(netKcal(3.5, 90, 1), 225);
  assert.equal(
    strengthNetKcal({ durationSeconds: 3600, weightKg: 90 }),
    225
  );
});

test("the D5 strength variants are pinned", () => {
  assert.deepEqual(STRENGTH_METS, { general: 3.5, intense: 6.0 });
  assert.equal(
    strengthNetKcal({
      durationSeconds: 3600,
      weightKg: 90,
      intensity: "intense",
    }),
    450 // (6 − 1) × 90 × 1
  );
});

test("cardio sessions price minutes against the catalog", () => {
  // Rowing, moderate (7.5): (7.5 − 1) × 90 × 0.5 = 292.5 → 293.
  assert.equal(
    cardioNetKcal({ activityId: "rowing-machine", minutes: 30, weightKg: 90 }),
    293
  );
  // Treadmill at 10 mph for an hour at 70 kg: 13.8 × 70 = 966.
  assert.equal(
    cardioNetKcal({
      activityId: "treadmill-run",
      variantId: "10-mph",
      minutes: 60,
      weightKg: 70,
    }),
    966
  );
});

test("missing inputs return null, never a guess", () => {
  assert.equal(strengthNetKcal({ durationSeconds: null, weightKg: 90 }), null);
  assert.equal(strengthNetKcal({ durationSeconds: 0, weightKg: 90 }), null);
  assert.equal(strengthNetKcal({ durationSeconds: -60, weightKg: 90 }), null);
  assert.equal(
    strengthNetKcal({ durationSeconds: 3600, weightKg: null }),
    null
  );
  assert.equal(
    cardioNetKcal({ activityId: "rowing-machine", minutes: null, weightKg: 90 }),
    null
  );
  assert.equal(
    cardioNetKcal({ activityId: "rowing-machine", minutes: 0, weightKg: 90 }),
    null
  );
  assert.equal(
    cardioNetKcal({ activityId: "not-a-real-activity", minutes: 30, weightKg: 90 }),
    null
  );
  assert.equal(netKcal(3.5, 90, null), null);
  assert.equal(netKcalPerMinute(3.5, null), null);
});

test("per-minute shape helper for the later cal/min display", () => {
  // (3.5 − 1) × 90 ÷ 60 = 3.75 net kcal per minute at 90 kg.
  assert.equal(netKcalPerMinute(3.5, 90), 3.75);
});

test("workoutNetKcal dispatches both session shapes through one symbol", () => {
  assert.equal(
    workoutNetKcal({ kind: "strength", durationSeconds: 3600, weightKg: 90 }),
    225
  );
  assert.equal(
    workoutNetKcal({
      kind: "cardio",
      activityId: "rowing-machine",
      minutes: 30,
      weightKg: 90,
    }),
    293
  );
});

test("the day total sums computable sessions and never invents one", () => {
  assert.equal(exerciseKcalForDay([225, null, 293]), 518);
  assert.equal(exerciseKcalForDay([null, null]), null);
  assert.equal(exerciseKcalForDay([]), null);
});

/* --------------------------------------------------------- registry pins */

test("every energy metric is registered as an estimate", () => {
  const energyIds = [
    "energy.recommendedTarget",
    "energy.maintenance.kcalPerDay",
    "energy.workout.kcal",
    "energy.exercise.kcalPerDay",
  ] as const;
  for (const id of energyIds) {
    assert.equal(METRICS[id].estimated, true, `${id} must be estimated`);
    assert.equal(METRICS[id].unit, "kcal");
  }
});
