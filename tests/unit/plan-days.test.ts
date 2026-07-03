import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPlanTarget,
  normalizePlanDays,
  parsePlanDays,
} from "@/lib/validation/plan-days";
import {
  lastSetsByExercise,
  type WorkoutData,
} from "@/lib/workouts/stats";

describe("normalizePlanDays", () => {
  it("accepts a valid program and snaps names to library casing", () => {
    const days = normalizePlanDays([
      {
        name: "Day 1: Upper",
        exercises: [
          { name: "barbell bench press", sets: 4, reps: "4-6", weight: 185, unit: "lb" },
          { name: "Machine Chest Fly", sets: 3, reps: "10-12" },
        ],
      },
    ]);
    assert.ok(days);
    assert.equal(days.length, 1);
    // Library match snaps to canonical casing…
    assert.equal(days[0].exercises[0].name, "Barbell Bench Press");
    // …an unknown exercise keeps what the plan wrote.
    assert.equal(days[0].exercises[1].name, "Machine Chest Fly");
    // Defaults fill in.
    assert.equal(days[0].exercises[1].weight, null);
    assert.equal(days[0].exercises[1].unit, "lb");
  });

  it("rejects junk instead of throwing", () => {
    assert.equal(normalizePlanDays(null), null);
    assert.equal(normalizePlanDays([]), null);
    assert.equal(normalizePlanDays([{ name: "Day 1", exercises: [] }]), null);
    assert.equal(
      normalizePlanDays([
        { name: "Day 1", exercises: [{ name: "Squat", sets: 0, reps: "5" }] },
      ]),
      null
    );
  });

  it("parsePlanDays treats a null column as no days", () => {
    assert.equal(parsePlanDays(null), null);
    assert.equal(parsePlanDays(undefined), null);
  });
});

describe("formatPlanTarget", () => {
  it("shows sets x reps, load, and note when present", () => {
    assert.equal(
      formatPlanTarget({
        name: "Barbell Bench Press",
        sets: 4,
        reps: "4-6",
        weight: 185,
        unit: "lb",
        note: "RPE 8",
      }),
      "4 x 4-6 @ 185 lb · RPE 8"
    );
    assert.equal(
      formatPlanTarget({ name: "Pull-Up", sets: 3, reps: "AMRAP" }),
      "3 x AMRAP"
    );
  });
});

describe("lastSetsByExercise", () => {
  const workout = (
    performedAt: string,
    name: string,
    sets: { weight: number | null; reps: number | null }[]
  ): WorkoutData => ({
    id: performedAt,
    title: "W",
    performedAt,
    durationSeconds: null,
    notes: null,
    exercises: [
      {
        name,
        muscleGroup: null,
        notes: null,
        sets: sets.map((s) => ({
          ...s,
          unit: "lb" as const,
          rpe: null,
          setType: "working" as const,
          completed: true,
        })),
      },
    ],
  });

  it("returns the most recent session's working sets per exercise", () => {
    const map = lastSetsByExercise([
      workout("2026-07-01T12:00:00Z", "Barbell Bench Press", [
        { weight: 185, reps: 8 },
        { weight: 185, reps: 7 },
      ]),
      workout("2026-06-24T12:00:00Z", "Barbell Bench Press", [
        { weight: 175, reps: 8 },
      ]),
    ]);
    const sets = map["barbell bench press"];
    assert.ok(sets);
    assert.equal(sets.length, 2);
    assert.equal(sets[0].weight, 185);
    assert.equal(sets[0].reps, 8);
  });

  it("skips warmups and incomplete sets", () => {
    const w = workout("2026-07-01T12:00:00Z", "Deadlift", [
      { weight: 135, reps: 5 },
      { weight: 315, reps: 5 },
    ]);
    w.exercises[0].sets[0].setType = "warmup";
    const map = lastSetsByExercise([w]);
    assert.equal(map.deadlift.length, 1);
    assert.equal(map.deadlift[0].weight, 315);
  });
});
