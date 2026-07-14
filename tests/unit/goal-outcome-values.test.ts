/**
 * buildGoalVM alias-ref regression (P56-Z adversarial P1-1). A lift goal
 * saved with an ALIAS spelling ("Bench Press") must grade against the
 * CANONICAL history buildGoalVM receives ("Barbell Bench Press"), through
 * the same identity resolution canonicalizeWorkouts used. Before the fix
 * the raw metricRef matched nothing and the outcome silently read no-data
 * while /goals (raw history) still showed a value: two screens disagreed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Goal } from "../../lib/db/schema";
import { buildGoalVM } from "../../lib/goals/outcome-values";
import {
  canonicalizeWorkouts,
  type ResolveOptions,
} from "../../lib/workouts/exercise-identity";
import type { WorkoutData } from "../../lib/workouts/stats";

const liftGoal = {
  id: "goal-lift",
  userId: "user-1",
  title: "Bench 245",
  detail: "",
  targetDate: null,
  status: "active",
  source: "user",
  sourceChatId: null,
  metric: "lift",
  metricRef: "Bench Press",
  startValue: 200,
  currentValue: null,
  targetValue: 245,
  unit: "lb",
  createdAt: new Date(0),
  updatedAt: new Date(0),
} as Goal;

function benchWorkout(name: string, weight: number): WorkoutData {
  return {
    id: `w-${name}-${weight}`,
    performedAt: new Date("2026-07-01T17:00:00Z"),
    exercises: [
      {
        name,
        sets: [{ reps: 5, weight, unit: "lb", completed: true }],
      },
    ],
  } as unknown as WorkoutData;
}

describe("buildGoalVM e1rm ref canonicalization (P56-Z P1-1)", () => {
  const opts: ResolveOptions = {};

  it("an alias-spelled metricRef matches the canonical history", () => {
    // "Bench Press" folds to "Barbell Bench Press" in the curated set; the
    // history buildGoalVM receives is ALWAYS canonicalized by its callers.
    const canonical = canonicalizeWorkouts(
      [benchWorkout("Bench Press", 230)],
      opts
    );
    assert.equal(canonical[0].exercises[0].name, "Barbell Bench Press");

    const vm = buildGoalVM(liftGoal, [], {
      trendWeight: null,
      trendUnit: "lb",
      canonicalWorkouts: canonical,
      latestMeasurementByKind: new Map(),
      resolveOptions: opts,
    });

    const outcome = vm.outcomes[0];
    assert.ok(outcome, "the legacy lift goal resolves to an outcome");
    assert.ok(
      outcome.currentText != null,
      "alias-spelled ref must not read as no-data against canonical history"
    );
  });

  it("omitting resolveOptions still folds curated aliases", () => {
    const canonical = canonicalizeWorkouts(
      [benchWorkout("Bench Press", 230)],
      {}
    );
    const vm = buildGoalVM(liftGoal, [], {
      trendWeight: null,
      trendUnit: "lb",
      canonicalWorkouts: canonical,
      latestMeasurementByKind: new Map(),
    });
    assert.ok(vm.outcomes[0]?.currentText != null);
  });
});
