/**
 * FIX-34 canonical exercise identity tests. Two jobs:
 * 1. SAFETY invariants of the curated alias set (no built-in ever remaps, no
 *    alias collides with a built-in, member customs are never folded).
 * 2. RECONCILIATION proof: records/PRs stop splitting across aliases when
 *    stats run over canonicalized workouts, and unrelated names are untouched.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAliasMergePreview,
} from "../../lib/workouts/alias-merge-preview";
import {
  CURATED_ALIASES,
  canonicalSlug,
  canonicalizeWorkouts,
  normalizeExerciseKey,
  resolveExerciseIdentity,
} from "../../lib/workouts/exercise-identity";
import { BUILT_IN_EXERCISES } from "../../lib/workouts/exercise-library";
import {
  computePersonalRecords,
  type WorkoutData,
} from "../../lib/workouts/stats";
import { consistentPersona } from "../fixtures/dashboard-states";

function makeWorkout(
  id: string,
  daysAgo: number,
  exercises: { name: string; weight: number; reps: number }[]
): WorkoutData {
  return {
    id,
    title: "Session",
    performedAt: new Date(Date.UTC(2026, 6, 8) - daysAgo * 86400000).toISOString(),
    durationSeconds: null,
    notes: null,
    exercises: exercises.map((e) => ({
      name: e.name,
      muscleGroup: null,
      kind: "weighted" as const,
      supersetGroup: null,
      notes: null,
      sets: [
        {
          weight: e.weight,
          reps: e.reps,
          unit: "lb" as const,
          rpe: null,
          setType: "working" as const,
          completed: true,
        },
      ],
    })),
  };
}

describe("normalizeExerciseKey", () => {
  it("folds case, whitespace, hyphens, and periods", () => {
    assert.equal(normalizeExerciseKey("  Push-Up "), "push up");
    assert.equal(normalizeExerciseKey("PUSH  UP"), "push up");
    assert.equal(normalizeExerciseKey("T-Bar Row"), "t bar row");
    assert.equal(normalizeExerciseKey("Sit-Up"), "sit up");
  });

  it("keys Hevy-style parenthesized names", () => {
    assert.equal(
      normalizeExerciseKey("Bench Press (Barbell)"),
      "bench press barbell"
    );
  });

  it("drops apostrophes", () => {
    assert.equal(normalizeExerciseKey("Farmer's Walk"), "farmers walk");
  });
});

describe("curated alias set safety invariants", () => {
  const builtInKeys = new Set(
    BUILT_IN_EXERCISES.map((e) => normalizeExerciseKey(e.name))
  );
  const builtInNames = new Set(BUILT_IN_EXERCISES.map((e) => e.name));

  it("every canonical target is an exact built-in name", () => {
    for (const a of CURATED_ALIASES) {
      assert.ok(
        builtInNames.has(a.canonical),
        `alias "${a.alias}" targets unknown canonical "${a.canonical}"`
      );
    }
  });

  it("no alias key collides with a built-in name (a built-in can never remap)", () => {
    for (const a of CURATED_ALIASES) {
      assert.ok(
        !builtInKeys.has(normalizeExerciseKey(a.alias)),
        `alias "${a.alias}" collides with a built-in exercise name`
      );
    }
  });

  it("no duplicate alias keys", () => {
    const seen = new Set<string>();
    for (const a of CURATED_ALIASES) {
      const key = normalizeExerciseKey(a.alias);
      assert.ok(!seen.has(key), `duplicate alias key "${key}"`);
      seen.add(key);
    }
  });

  it("every built-in resolves to itself", () => {
    for (const e of BUILT_IN_EXERCISES) {
      const res = resolveExerciseIdentity(e.name);
      assert.equal(res.canonicalName, e.name);
      assert.equal(res.matchedVia, "built-in");
    }
  });
});

describe("resolveExerciseIdentity", () => {
  it("resolves curated aliases to the canonical built-in", () => {
    const res = resolveExerciseIdentity("Bench Press");
    assert.equal(res.canonicalName, "Barbell Bench Press");
    assert.equal(res.matchedVia, "curated-alias");
    assert.equal(res.confidence, "high");
    assert.equal(resolveExerciseIdentity("OHP").canonicalName, "Overhead Press");
    assert.equal(
      resolveExerciseIdentity("Bench Press (Barbell)").canonicalName,
      "Barbell Bench Press"
    );
  });

  it("never folds a name matching the member's own custom exercise", () => {
    const res = resolveExerciseIdentity("Bench Press", {
      memberCustomNames: ["Bench Press"],
    });
    assert.equal(res.canonicalName, "Bench Press");
    assert.equal(res.matchedVia, "member-custom");
  });

  it("leaves unknown names untouched", () => {
    const res = resolveExerciseIdentity("Nordic Curl");
    assert.equal(res.canonicalName, "Nordic Curl");
    assert.equal(res.matchedVia, "unmatched");
  });

  it("applies approved member aliases before the curated set", () => {
    const res = resolveExerciseIdentity("My Gym Press", {
      memberAliases: new Map([["my gym press", "Chest Press Machine"]]),
    });
    assert.equal(res.canonicalName, "Chest Press Machine");
    assert.equal(res.matchedVia, "member-alias");
  });

  it("exposes stable slugs", () => {
    assert.equal(canonicalSlug("Barbell Bench Press"), "barbell-bench-press");
    assert.equal(resolveExerciseIdentity("bench press").slug, "barbell-bench-press");
  });
});

describe("record reconciliation across aliases", () => {
  const workouts = [
    makeWorkout("w1", 10, [
      { name: "Bench Press", weight: 185, reps: 5 },
      { name: "Nordic Curl", weight: 0, reps: 8 },
    ]),
    makeWorkout("w2", 5, [{ name: "Barbell Bench Press", weight: 225, reps: 3 }]),
    makeWorkout("w3", 2, [{ name: "bench", weight: 205, reps: 4 }]),
  ];

  it("splits records without resolution (the FIX-34 defect)", () => {
    const names = computePersonalRecords(workouts).map((r) => r.exerciseName);
    assert.ok(names.includes("Bench Press"));
    assert.ok(names.includes("Barbell Bench Press"));
    assert.ok(names.includes("bench"));
  });

  it("reconciles to ONE record with the true bests after canonicalization", () => {
    const records = computePersonalRecords(canonicalizeWorkouts(workouts));
    const bench = records.filter((r) =>
      r.exerciseName.toLowerCase().includes("bench")
    );
    assert.equal(bench.length, 1);
    assert.equal(bench[0].exerciseName, "Barbell Bench Press");
    assert.equal(bench[0].bestWeight, 225);
    assert.equal(bench[0].bestWeightReps, 3);
    // Last performed = the most recent variant session (w3).
    assert.equal(bench[0].lastPerformed, workouts[2].performedAt);
  });

  it("does not touch unrelated exercises or mutate its input", () => {
    const before = JSON.stringify(workouts);
    const canonical = canonicalizeWorkouts(workouts);
    assert.equal(JSON.stringify(workouts), before);
    const nordic = canonical[0].exercises[1];
    assert.equal(nordic.name, "Nordic Curl");
  });

  it("respects the member-custom exclusion end to end", () => {
    const records = computePersonalRecords(
      canonicalizeWorkouts(workouts, { memberCustomNames: ["Bench Press"] })
    );
    const names = records.map((r) => r.exerciseName);
    // The custom keeps its own record; the other two variants still merge.
    assert.ok(names.includes("Bench Press"));
    assert.ok(names.includes("Barbell Bench Press"));
    assert.ok(!names.includes("bench"));
  });
});

describe("buildAliasMergePreview", () => {
  const workouts = [
    makeWorkout("w1", 10, [
      { name: "Bench Press", weight: 185, reps: 5 },
      { name: "Nordic Curl", weight: 45, reps: 8 },
    ]),
    makeWorkout("w2", 5, [{ name: "Barbell Bench Press", weight: 225, reps: 3 }]),
  ];

  it("groups merging names with before/after records", () => {
    const preview = buildAliasMergePreview(workouts);
    assert.equal(preview.groups.length, 1);
    const g = preview.groups[0];
    assert.equal(g.canonicalName, "Barbell Bench Press");
    assert.equal(g.members.length, 2);
    assert.equal(g.recordsBefore.length, 2);
    assert.equal(g.recordAfter?.bestWeight, 225);
    // Nordic Curl is untouched.
    assert.equal(preview.untouchedNameCount, 1);
    assert.equal(preview.totalDistinctNames, 3);
  });

  it("reports custom shadows as informational, never as merges", () => {
    const preview = buildAliasMergePreview(workouts, {
      memberCustomNames: ["Bench Press", "Nordic Curl"],
    });
    assert.deepEqual(preview.customShadows, [
      { customName: "Bench Press", wouldHaveMergedInto: "Barbell Bench Press" },
    ]);
    // With the custom protected, only the rename-normalization of the OTHER
    // variant remains; "Bench Press" itself must not appear in any group.
    for (const g of preview.groups) {
      assert.ok(!g.members.some((m) => m.rawName === "Bench Press"));
    }
  });

  it("is a pure read: inputs are not mutated", () => {
    const before = JSON.stringify(workouts);
    buildAliasMergePreview(workouts);
    assert.equal(JSON.stringify(workouts), before);
  });
});

describe("fixture personas stay coherent under resolution", () => {
  it("consistent persona: 'Bench Press' history reconciles into the canonical identity", () => {
    const preview = buildAliasMergePreview(consistentPersona.workouts);
    const bench = preview.groups.find(
      (g) => g.canonicalName === "Barbell Bench Press"
    );
    assert.ok(bench, "fixture Bench Press history should form a merge group");
    assert.ok(
      bench.members.every((m) => m.matchedVia === "curated-alias"),
      "fixture names resolve via the curated set"
    );
    // Barbell Row is a built-in already: never in a merge group.
    assert.ok(
      preview.groups.every((g) => g.canonicalName !== "Barbell Row"),
      "built-in names must not appear as merges"
    );
  });
});
