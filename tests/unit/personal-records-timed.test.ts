// Phase 3 regression: timed exercises store SECONDS in the reps column, so
// the personal-records rail must skip them entirely. Before this fix a
// logged 30-minute row surfaced as "Rowing machine · Vigorous, Best 1800
// reps" on the Workouts home. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computePersonalRecords,
  type WorkoutData,
} from "../../lib/workouts/stats";

const CARDIO_SESSION: WorkoutData = {
  id: "w1",
  title: "Rowing machine",
  performedAt: "2026-07-19T10:00:00.000Z",
  durationSeconds: 1800,
  notes: null,
  exercises: [
    {
      name: "Rowing machine · Vigorous",
      muscleGroup: "cardio",
      kind: "timed",
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
};

const LIFT_SESSION: WorkoutData = {
  id: "w2",
  title: "Push Day",
  performedAt: "2026-07-19T18:00:00.000Z",
  durationSeconds: 3600,
  notes: null,
  exercises: [
    {
      name: "Bench Press",
      muscleGroup: "chest",
      kind: "weighted",
      notes: null,
      sets: [
        {
          weight: 185,
          reps: 8,
          unit: "lb",
          rpe: null,
          setType: "working",
          completed: true,
        },
      ],
    },
  ],
};

test("timed cardio never produces a personal record; lifts still do", () => {
  const records = computePersonalRecords([CARDIO_SESSION, LIFT_SESSION]);
  assert.equal(records.length, 1);
  assert.equal(records[0].exerciseName, "Bench Press");
  assert.equal(records[0].bestWeight, 185);
});
