// DSH-28 test. Run with: pnpm test:unit
//
// A "lift" goal tracks an exercise's estimated 1RM against a target, charted
// from the PR data already collected. This pins the two pure pieces that power
// it: `exercise1RMTrend` (the trend read from logged sets) and
// `computeGoalProgress` anchored on the FIRST logged e1RM (lift goals store no
// startValue — the baseline comes from the training log).

import assert from "node:assert/strict";
import { test } from "node:test";
import { computeGoalProgress } from "../../lib/goals/progress";
import { exercise1RMTrend, type WorkoutData } from "../../lib/workouts/stats";

function workout(
  performedAt: string,
  name: string,
  sets: { weight: number; reps: number }[]
): WorkoutData {
  return {
    id: performedAt,
    title: "Session",
    performedAt,
    durationSeconds: null,
    notes: null,
    exercises: [
      {
        name,
        muscleGroup: null,
        notes: null,
        sets: sets.map((s) => ({
          weight: s.weight,
          reps: s.reps,
          unit: "lb" as const,
          rpe: null,
          setType: "working" as const,
          completed: true,
        })),
      },
    ],
  };
}

test("lift goal: e1RM trend + progress anchored on the first logged session", () => {
  // Marcus's squat, three sessions. Epley: w*(1+reps/30).
  // 315x3 → 346.5→347, 335x3 → 368.5→369(rounded), 345x2 → 368→368.
  const workouts = [
    workout("2026-06-01", "Back Squat", [{ weight: 315, reps: 3 }]),
    workout("2026-06-08", "Back Squat", [{ weight: 335, reps: 3 }]),
    workout("2026-06-15", "Back Squat", [{ weight: 345, reps: 2 }]),
  ];
  const points = exercise1RMTrend(workouts, "back squat");
  assert.equal(points.length, 3);
  const first = points[0].value; // 347
  const current = points.at(-1)?.value ?? null; // 368
  assert.equal(first, 347);
  assert.equal(current, 368);

  // Target 405 e1RM, no stored startValue → anchor on the first session.
  const p = computeGoalProgress({
    startValue: null,
    targetValue: 405,
    current,
    firstWeight: first,
  });
  assert.ok(p);
  // (368 - 347) / (405 - 347) = 21 / 58 = 36.2% → 36%.
  assert.equal(p.pct, 36);
  assert.equal(p.toGo, 37);
  assert.equal(p.reached, false);
});

test("lift goal with no logged sets yet yields an empty trend + null progress", () => {
  const points = exercise1RMTrend([], "Deadlift");
  assert.equal(points.length, 0);
  const p = computeGoalProgress({
    startValue: null,
    targetValue: 500,
    current: points.at(-1)?.value ?? null,
    firstWeight: points[0]?.value ?? null,
  });
  assert.equal(p, null);
});

test("lift goal marks reached once the est. 1RM meets the target", () => {
  const workouts = [
    workout("2026-06-01", "Bench Press", [{ weight: 225, reps: 1 }]),
    workout("2026-06-08", "Bench Press", [{ weight: 245, reps: 2 }]), // 245*(1+2/30)=261.3→261
  ];
  const points = exercise1RMTrend(workouts, "Bench Press");
  const p = computeGoalProgress({
    startValue: null,
    targetValue: 260,
    current: points.at(-1)?.value ?? null,
    firstWeight: points[0]?.value ?? null,
  });
  assert.ok(p);
  assert.equal(p.reached, true);
  assert.equal(p.pct, 100);
});
