// Calories-burned Phase 2 (owner rulings 2026-07-18): the target editor's
// "Recommended for you" engine. Run with: pnpm test:unit
//
// Pins the plan §4.1 precedence rule BOTH ways — observed expenditure
// outranks the Mifflin-St Jeor formula once the adaptive gates pass, and the
// formula is the day-0 fallback — plus the missing-data ask, the floors, the
// no-clamp day-0 path, and agreement with computeAdaptiveTarget so the
// recommendation block and the recalibration card can never show two
// different numbers.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_LEVELS } from "../../lib/energy/tdee";
import {
  computeAdaptiveTarget,
  observedEnergyBalance,
  type ObservedEnergyBalance,
} from "../../lib/nutrition/adaptive-target";
import {
  recommendTargetForUser,
  type TargetRecommendationInputs,
} from "../../lib/nutrition/target-recommendation";
import { ACTIVITY_OPTIONS, profileSchema } from "../../lib/profile";
import { hasWeighIn } from "../../lib/progress/weight";
import { progressEntrySchema } from "../../lib/validation/progress";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 7);

/** Daily weigh-ins ending yesterday, moving linearly by `ratePerWeek`. */
function weighIns(opts: {
  start: number;
  days: number;
  ratePerWeek: number;
  unit?: "lb" | "kg";
}) {
  return Array.from({ length: opts.days }, (_, i) => ({
    t: NOW - (opts.days - i) * DAY,
    weight: opts.start + (opts.ratePerWeek * i) / 7,
    unit: opts.unit ?? ("lb" as const),
  }));
}

/** `days` fully-logged days ending yesterday at `calories` each. */
function intake(days: number, calories: number) {
  return Array.from({ length: days }, (_, i) => ({
    t: NOW - (days - i) * DAY,
    calories,
  }));
}

const COMPLETE_PROFILE = {
  sex: "male" as const,
  age: 30,
  heightCm: 180,
  activityLevel: "moderate" as const,
};

const OBSERVED: ObservedEnergyBalance = {
  unit: "lb",
  expenditure: 2800,
  avgIntake: 2300,
  loggedDays: 12,
  observedRate: -1,
  trendWeight: 209,
};

function inputs(
  over: Partial<TargetRecommendationInputs> = {}
): TargetRecommendationInputs {
  return {
    profile: { ...COMPLETE_PROFILE },
    latestWeight: { value: 90, unit: "kg" },
    goalWeight: null,
    currentTarget: null,
    observed: null,
    ...over,
  };
}

/* ------------------------------------------------- precedence, both ways */

test("no observed data → the formula recommends (day-0 fallback)", () => {
  // Male 30y, 180 cm, 90 kg, moderate: BMR 1,880 → maintenance 2,914 →
  // no goal → maintenance pace, rounded to 2,925.
  const rec = recommendTargetForUser(inputs());
  assert.equal(rec.kind, "ready");
  if (rec.kind !== "ready") {
    return;
  }
  assert.equal(rec.basis, "stats");
  assert.equal(rec.burnPerDay, 2914);
  assert.equal(rec.target, 2925);
  assert.equal(rec.desiredRate, 0);
  assert.equal(rec.floored, false);
  assert.equal(rec.protein, null); // no current macro set → calories only
  assert.equal(rec.matchesCurrent, false);
});

test("observed data OUTRANKS the formula, even with a complete profile", () => {
  // Same complete profile, but the logs say the burn is 2,800: the
  // recommendation must come from the logs, not Mifflin-St Jeor.
  const rec = recommendTargetForUser(
    inputs({ observed: { ...OBSERVED }, goalWeight: 195 })
  );
  assert.equal(rec.kind, "ready");
  if (rec.kind !== "ready") {
    return;
  }
  assert.equal(rec.basis, "logs");
  assert.equal(rec.burnPerDay, 2800);
  // Day 0 (no current target): no step clamp. 209 lb trend → cut pace
  // 1.5675 lb/wk → 2,800 − 783.75 → 2,025.
  assert.equal(rec.target, 2025);
  assert.equal(rec.desiredRate, -1.6);
  assert.equal(rec.unit, "lb");
});

test("observed basis needs no profile: nothing is asked for", () => {
  // Empty profile + no weigh-in row, but the adaptive gates passed: the
  // member gets a recommendation, not a questionnaire.
  const rec = recommendTargetForUser(
    inputs({
      profile: { sex: null, age: null, heightCm: null, activityLevel: null },
      latestWeight: null,
      observed: { ...OBSERVED },
    })
  );
  assert.equal(rec.kind, "ready");
  if (rec.kind !== "ready") {
    return;
  }
  assert.equal(rec.basis, "logs");
});

test("with a current target, the logs basis agrees with computeAdaptiveTarget exactly", () => {
  // The recommendation block and the recalibration card must never show two
  // different numbers: same series through both paths → same target + macros.
  const series = {
    weighIns: weighIns({ start: 215, days: 42, ratePerWeek: -1 }),
    intakeDays: intake(14, 2300),
    nowMs: NOW,
  };
  const target = { calories: 2300, protein: 190, carbs: 205, fat: 70 };
  const engine = computeAdaptiveTarget({ ...series, target, goalWeight: 195 });
  assert.equal(engine.kind, "recommend");
  if (engine.kind !== "recommend") {
    return;
  }
  const observed = observedEnergyBalance(series);
  assert.equal(observed.kind, "ok");
  if (observed.kind !== "ok") {
    return;
  }
  const rec = recommendTargetForUser(
    inputs({ observed, currentTarget: target, goalWeight: 195 })
  );
  assert.equal(rec.kind, "ready");
  if (rec.kind !== "ready") {
    return;
  }
  assert.equal(rec.target, engine.calories);
  assert.equal(rec.burnPerDay, engine.expenditure);
  assert.equal(rec.desiredRate, engine.desiredRate);
  assert.equal(rec.protein, engine.protein);
  assert.equal(rec.carbs, engine.carbs);
  assert.equal(rec.fat, engine.fat);
});

/* ------------------------------------------------------ missing-data ask */

test("empty profile with no logs → every formula input asked, in ask order", () => {
  const rec = recommendTargetForUser(
    inputs({
      profile: { sex: null, age: null, heightCm: null, activityLevel: null },
      latestWeight: null,
    })
  );
  assert.deepEqual(rec, {
    kind: "missing",
    missing: ["activity", "sex", "age", "height", "weight"],
  });
});

test("only what's missing is asked", () => {
  const noWeight = recommendTargetForUser(inputs({ latestWeight: null }));
  assert.deepEqual(noWeight, { kind: "missing", missing: ["weight"] });

  const noActivity = recommendTargetForUser(
    inputs({ profile: { ...COMPLETE_PROFILE, activityLevel: null } })
  );
  assert.deepEqual(noActivity, { kind: "missing", missing: ["activity"] });
});

/* ------------------------------------------------------- formula details */

test("formula path honors the goal pace and the sex floor", () => {
  // Small member far above a low goal weight: the arithmetic lands under
  // 1,200 → the female floor holds and is flagged.
  const rec = recommendTargetForUser(
    inputs({
      profile: {
        sex: "female",
        age: 60,
        heightCm: 150,
        activityLevel: "sedentary",
      },
      latestWeight: { value: 45, unit: "kg" },
      goalWeight: 40,
    })
  );
  assert.equal(rec.kind, "ready");
  if (rec.kind !== "ready") {
    return;
  }
  assert.equal(rec.basis, "stats");
  assert.equal(rec.burnPerDay, 1112); // 926.5 BMR × 1.2
  assert.equal(rec.target, 1200);
  assert.equal(rec.floored, true);
  assert.ok(rec.desiredRate < 0);
});

test("formula path rebalances a complete macro set, protein anchored", () => {
  const rec = recommendTargetForUser(
    inputs({
      currentTarget: { calories: 2300, protein: 190, carbs: 205, fat: 70 },
    })
  );
  assert.equal(rec.kind, "ready");
  if (rec.kind !== "ready") {
    return;
  }
  assert.equal(rec.protein, 190);
  const macroCal =
    190 * 4 + (rec.carbs ?? 0) * 4 + (rec.fat ?? 0) * 9;
  assert.ok(
    Math.abs(macroCal - rec.target) <= 15,
    `macros add to ${macroCal} vs target ${rec.target}`
  );
});

test("a recommendation equal to the current target says so", () => {
  const rec = recommendTargetForUser(
    inputs({
      currentTarget: { calories: 2925, protein: null, carbs: null, fat: null },
    })
  );
  assert.equal(rec.kind, "ready");
  if (rec.kind !== "ready") {
    return;
  }
  assert.equal(rec.matchesCurrent, true);
});

/* ------------------------------------------------- shared vocabulary pins */

test("ACTIVITY_OPTIONS matches the energy engine's enum, in order", () => {
  assert.deepEqual(
    ACTIVITY_OPTIONS.map((o) => o.value),
    [...ACTIVITY_LEVELS]
  );
  // Every option is answerable without a glossary: label + plain description.
  for (const o of ACTIVITY_OPTIONS) {
    assert.ok(o.label.length > 0 && o.description.length > 10);
  }
});

test("profileSchema accepts and round-trips activityLevel", () => {
  const parsed = profileSchema.safeParse({ activityLevel: "light" });
  assert.ok(parsed.success);
  assert.equal(parsed.success && parsed.data.activityLevel, "light");
  const cleared = profileSchema.safeParse({ activityLevel: null });
  assert.ok(cleared.success);
  const bad = profileSchema.safeParse({ activityLevel: "extreme" });
  assert.equal(bad.success, false);
});

/* ------------------------------------------- first-weigh-in guard (owner
   correction 2026-07-19: the onboarding wizard's weight answer is saved as
   the member's first weigh-in through the SAME code path as the target
   editor's missing-data ask; hasWeighIn is the guard that keeps "first"
   literal for both callers). */

test("hasWeighIn: only entries carrying a weight count as weigh-ins", () => {
  assert.equal(hasWeighIn([]), false);
  // Photo-only and note-only progress entries are not weigh-ins.
  assert.equal(hasWeighIn([{ weight: null }, { weight: null }]), false);
  assert.equal(hasWeighIn([{ weight: 198 }]), true);
  assert.equal(hasWeighIn([{ weight: null }, { weight: 82.5 }]), true);
});

test("the wizard weight rides the canonical weigh-in validation", () => {
  // Valid weight + unit → the exact values the ProgressEntry stores.
  const ok = progressEntrySchema.safeParse({ weight: 198, unit: "lb" });
  assert.ok(ok.success);
  assert.equal(ok.success && ok.data.weight, 198);
  assert.equal(ok.success && ok.data.unit, "lb");
  // A skipped weight field is NOT a valid weigh-in (nothing gets created).
  assert.equal(
    progressEntrySchema.safeParse({ weight: null, unit: "kg" }).success,
    false
  );
  // Bounds are the /progress form's own: positive, at most 2000.
  assert.equal(
    progressEntrySchema.safeParse({ weight: 0, unit: "lb" }).success,
    false
  );
  assert.equal(
    progressEntrySchema.safeParse({ weight: 2001, unit: "lb" }).success,
    false
  );
});
