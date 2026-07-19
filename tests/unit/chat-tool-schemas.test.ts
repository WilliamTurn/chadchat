// Calories-burned Phase 4: the tool-schema regression suite. Pins the input
// schemas of Chad's energy-touching tools (lib/ai/tool-schemas.ts — the real
// schemas the tools mount, not copies), the shared cardio write shape the
// chat tool and the /workouts/cardio page both build rows through, and the
// weekly report's exercise-calorie computation + block. Run with:
// pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDayLog } from "../../lib/ai/dashboard";
import {
  getDashboardInputSchema,
  logCardioInputSchema,
  logWorkoutInputSchema,
  updateProfileInputSchema,
} from "../../lib/ai/tool-schemas";
import type { WorkoutWithChildren } from "../../lib/db/queries";
import {
  ACTIVITY_CATALOG,
  metForExerciseName,
} from "../../lib/energy/activity-catalog";
import { ACTIVITY_LEVELS } from "../../lib/energy/tdee";
import {
  formatExerciseCalories,
  weekExerciseKcal,
} from "../../lib/reports/exercise-energy";
import {
  buildCardioWorkout,
  resolveCardioVariant,
} from "../../lib/workouts/cardio-entry";

/* ------------------------------------------------------ logCardio schema */

test("logCardio accepts a full valid input", () => {
  const parsed = logCardioInputSchema.safeParse({
    activity: "rowing-machine",
    minutes: 30,
    intensity: "vigorous",
    recordedAt: "2026-07-19",
  });
  assert.ok(parsed.success);
});

test("logCardio's activity enum is pinned to the catalog's ids", () => {
  for (const activity of ACTIVITY_CATALOG) {
    assert.ok(
      logCardioInputSchema.safeParse({ activity: activity.id, minutes: 20 })
        .success,
      `catalog id ${activity.id} must be a valid activity`
    );
  }
  assert.equal(
    logCardioInputSchema.safeParse({ activity: "vibes", minutes: 20 }).success,
    false
  );
});

test("logCardio rejects bad minutes and dates", () => {
  const bad = [
    { activity: "hiking", minutes: 0 },
    { activity: "hiking", minutes: 1441 },
    { activity: "hiking", minutes: 12.5 },
    { activity: "hiking", minutes: 30, recordedAt: "July 19" },
  ];
  for (const input of bad) {
    assert.equal(logCardioInputSchema.safeParse(input).success, false);
  }
  // intensity and recordedAt stay optional.
  assert.ok(
    logCardioInputSchema.safeParse({ activity: "hiking", minutes: 45 }).success
  );
});

/* ----------------------------------------------------- logWorkout schema */

const BENCH = {
  title: "Push Day",
  exercises: [
    {
      name: "Barbell Bench Press",
      sets: [{ weight: 185, reps: 8, unit: "lb" }],
    },
  ],
};

test("logWorkout still accepts the pre-Phase-4 shape (no duration)", () => {
  const parsed = logWorkoutInputSchema.safeParse(BENCH);
  assert.ok(parsed.success);
  assert.equal(parsed.data.durationMinutes, undefined);
});

test("logWorkout accepts durationMinutes and bounds it", () => {
  const parsed = logWorkoutInputSchema.safeParse({
    ...BENCH,
    durationMinutes: 60,
  });
  assert.ok(parsed.success);
  assert.equal(parsed.data.durationMinutes, 60);
  for (const minutes of [0, 1441, 45.5]) {
    assert.equal(
      logWorkoutInputSchema.safeParse({ ...BENCH, durationMinutes: minutes })
        .success,
      false,
      `durationMinutes ${minutes} must be rejected`
    );
  }
});

test("logWorkout regression: set unit defaults to lb, exercises required", () => {
  const parsed = logWorkoutInputSchema.parse({
    title: "Legs",
    exercises: [{ name: "Squat", sets: [{ weight: 225, reps: 5 }] }],
  });
  assert.equal(parsed.exercises[0].sets[0].unit, "lb");
  assert.equal(
    logWorkoutInputSchema.safeParse({ title: "Empty", exercises: [] }).success,
    false
  );
});

/* -------------------------------------------------- updateProfile schema */

test("updateProfile's activityLevel is pinned to the tdee enum", () => {
  for (const level of ACTIVITY_LEVELS) {
    assert.ok(
      updateProfileInputSchema.safeParse({ activityLevel: level }).success,
      `activity level ${level} must be valid`
    );
  }
  assert.equal(
    updateProfileInputSchema.safeParse({ activityLevel: "athlete" }).success,
    false
  );
});

test("updateProfile regression: existing fields still parse", () => {
  assert.ok(
    updateProfileInputSchema.safeParse({
      primaryGoals: ["muscle", "fat_loss"],
      age: 30,
      heightCm: 180,
      sex: "male",
      experienceLevel: "intermediate",
      trainingDaysPerWeek: 4,
      soundEnabled: false,
    }).success
  );
  assert.equal(
    updateProfileInputSchema.safeParse({ age: 12 }).success,
    false
  );
});

/* --------------------------------------------------- getDashboard schema */

test("getDashboard dates stay YYYY-MM-DD", () => {
  assert.ok(
    getDashboardInputSchema.safeParse({
      date: "2026-07-01",
      endDate: "2026-07-19",
    }).success
  );
  assert.ok(getDashboardInputSchema.safeParse({}).success);
  assert.equal(
    getDashboardInputSchema.safeParse({ date: "07/01/2026" }).success,
    false
  );
});

/* ---------------------------------------------- shared cardio write shape */

test("buildCardioWorkout writes the exact Phase 3 row shapes", () => {
  const write = buildCardioWorkout({
    activityId: "rowing-machine",
    variantId: "vigorous",
    minutes: 30,
    performedAt: new Date("2026-07-19T12:00:00Z"),
    weightUnit: "lb",
  });
  assert.ok(write);
  assert.equal(write.title, "Rowing machine");
  assert.equal(write.durationSeconds, 1800);
  assert.equal(write.exercises.length, 1);
  const ex = write.exercises[0];
  assert.equal(ex.name, "Rowing machine · Vigorous");
  assert.equal(ex.muscleGroup, "cardio");
  assert.equal(ex.kind, "timed");
  assert.deepEqual(ex.sets, [
    {
      weight: null,
      reps: 1800,
      unit: "lb",
      rpe: null,
      setType: "working",
      completed: true,
    },
  ]);
  // The snapshot round-trips through read-time MET resolution at the
  // VARIANT's MET — the whole reason the name carries the effort.
  assert.equal(metForExerciseName(ex.name), 8.5);
});

test("buildCardioWorkout: no variant uses the plain label; kg unit follows", () => {
  const write = buildCardioWorkout({
    activityId: "hiking",
    minutes: 60,
    performedAt: new Date("2026-07-19T12:00:00Z"),
    weightUnit: "kg",
  });
  assert.ok(write);
  assert.equal(write.exercises[0].name, "Hiking");
  assert.equal(write.exercises[0].sets[0].unit, "kg");
});

test("buildCardioWorkout never guesses on unknown ids", () => {
  const base = {
    minutes: 30,
    performedAt: new Date("2026-07-19T12:00:00Z"),
    weightUnit: "lb" as const,
  };
  assert.equal(buildCardioWorkout({ ...base, activityId: "vibes" }), null);
  assert.equal(
    buildCardioWorkout({
      ...base,
      activityId: "rowing-machine",
      variantId: "imaginary",
    }),
    null
  );
});

test("resolveCardioVariant matches id or label, case-insensitive", () => {
  const rowing = ACTIVITY_CATALOG.find((a) => a.id === "rowing-machine");
  assert.equal(resolveCardioVariant(rowing, "vigorous")?.id, "vigorous");
  assert.equal(
    resolveCardioVariant(rowing, "All-Out Intervals")?.id,
    "all-out"
  );
  assert.equal(resolveCardioVariant(rowing, "ludicrous"), null);
  assert.equal(resolveCardioVariant(rowing, undefined), undefined);
  assert.equal(resolveCardioVariant(rowing, "  "), undefined);
});

/* --------------------------------------- weekly exercise calories + block */

/** A logged cardio session: one timed exercise, one completed set. */
function cardioSession(name: string, seconds: number) {
  return {
    durationSeconds: seconds,
    exercises: [
      {
        name,
        kind: "timed" as const,
        sets: [{ reps: seconds, completed: true }],
      },
    ],
  };
}

test("weekExerciseKcal sums computable sessions (golden 338 + 225)", () => {
  // (8.5−1) × 90 kg × 0.5 h = 337.5 → 338; (3.5−1) × 90 × 1 = 225.
  const week = weekExerciseKcal(
    [
      cardioSession("Rowing machine · Vigorous", 1800),
      {
        durationSeconds: 3600,
        exercises: [
          {
            name: "Barbell Bench Press",
            kind: "weighted" as const,
            sets: [{ reps: 8, completed: true }],
          },
        ],
      },
      // Not computable (no duration, nothing timed): contributes nothing.
      { durationSeconds: null, exercises: [] },
    ],
    90
  );
  assert.equal(week.kcal, 563);
  assert.equal(week.sessions, 2);
});

test("weekExerciseKcal without a weigh-in computes nothing", () => {
  const week = weekExerciseKcal(
    [cardioSession("Rowing machine · Vigorous", 1800)],
    null
  );
  assert.equal(week.kcal, null);
  assert.equal(week.sessions, 0);
});

test("formatExerciseCalories: both weeks, singular session, ~ framing", () => {
  const block = formatExerciseCalories(
    { kcal: 338, sessions: 1 },
    { kcal: null, sessions: 0 }
  );
  assert.match(block, /COMPUTED EXERCISE CALORIES/);
  assert.match(block, /This report week: ~338 kcal across 1 session\./);
  assert.match(
    block,
    /The week before: no sessions with a computable estimate\./
  );
  assert.match(block, /exactly ONE line/);
});

test("formatExerciseCalories is empty when neither week computes", () => {
  assert.equal(
    formatExerciseCalories(
      { kcal: null, sessions: 0 },
      { kcal: null, sessions: 0 }
    ),
    ""
  );
});

/* ------------------------------------- getDashboard exercise-kcal exposure */

const DAY_START = new Date("2026-07-19T00:00:00Z");
const DAY_END = new Date("2026-07-20T00:00:00Z");

/** One logged rowing session as the DB rows getDashboard reads. */
function rowingWorkout(): WorkoutWithChildren {
  return {
    id: "w1",
    title: "Rowing machine",
    performedAt: new Date("2026-07-19T09:00:00Z"),
    durationSeconds: 1800,
    notes: null,
    exercises: [
      {
        exerciseName: "Rowing machine · Vigorous",
        muscleGroup: "cardio",
        kind: "timed",
        supersetGroup: null,
        notes: null,
        sets: [
          {
            weight: null,
            reps: 1800,
            unit: "lb",
            rpe: null,
            setType: "working",
            completed: true,
          },
        ],
      },
    ],
  } as unknown as WorkoutWithChildren;
}

function dayLogWith(weightKg?: number | null) {
  return buildDayLog({
    start: DAY_START,
    end: DAY_END,
    meals: [],
    workouts: [rowingWorkout()],
    weighIns: [],
    waterMl: 0,
    measurements: [],
    ...(weightKg === undefined ? {} : { weightKg }),
  });
}

test("buildDayLog with a weight exposes per-session + total estimates", () => {
  const log = dayLogWith(90);
  assert.equal(log.exerciseKcal, 338);
  assert.equal(log.workouts[0].estimatedKcal, 338);
  assert.match(log.summary, /~338 cal estimated/);
  assert.match(log.summary, /counted toward the day's calorie budget/);
});

test("buildDayLog without the weightKg opt-in is unchanged (no burn text)", () => {
  const log = dayLogWith();
  assert.equal(log.exerciseKcal, null);
  assert.equal(log.workouts[0].estimatedKcal, null);
  assert.doesNotMatch(log.summary, /cal estimated/);
});

test("buildDayLog with no weigh-in on record estimates nothing", () => {
  const log = dayLogWith(null);
  assert.equal(log.exerciseKcal, null);
  assert.doesNotMatch(log.summary, /cal estimated/);
});
