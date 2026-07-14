/**
 * FIX-33 training analytics tests. Three jobs:
 * 1. DEDUP PROOF at the consumer level: PR events, counts, and lookup maps
 *    reconcile across aliases when computed over canonicalized workouts (the
 *    P34-E identity layer wired into stats consumers).
 * 2. PR-timeline semantics: replay emits record-beating sets only (first-ever
 *    sessions are baselines), and prCountsByWorkout derives from the SAME
 *    events so pills and timeline can never disagree.
 * 3. The new pure analytics: frequency slots, adherence series, milestones,
 *    muscle distribution, member-local volume bucketing.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { windowEndingAt } from "../../lib/chart/window";
import type { PlanSchedule } from "../../lib/plans/schedule";
import { canonicalizeWorkouts } from "../../lib/workouts/exercise-identity";
import {
  lastSetsByExercise,
  prCountsByWorkout,
  prEventsByWorkout,
  volumeTrend,
  type WorkoutData,
} from "../../lib/workouts/stats";
import {
  muscleGroupDistribution,
  nextSessionCountMilestone,
  perfectPlanWeekMilestones,
  sessionCountMilestones,
  weeklyAdherenceSeries,
  weeklyFrequencySlots,
  withAliasKeyEchoes,
} from "../../lib/workouts/training-analytics";

const DAY_MS = 86_400_000;
const ANCHOR = Date.UTC(2026, 6, 8); // 2026-07-08, the fixture anchor day

function makeWorkout(
  id: string,
  daysAgo: number,
  exercises: {
    name: string;
    weight: number;
    reps: number;
    muscleGroup?: string | null;
    kind?: "weighted" | "timed";
  }[]
): WorkoutData {
  return {
    id,
    title: `Session ${id}`,
    performedAt: new Date(ANCHOR - daysAgo * DAY_MS + 18 * 3_600_000).toISOString(),
    durationSeconds: null,
    notes: null,
    exercises: exercises.map((e) => ({
      name: e.name,
      muscleGroup: e.muscleGroup ?? null,
      kind: e.kind ?? ("weighted" as const),
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

/* --------------------------------------------------------- PR event replay */

describe("prEventsByWorkout", () => {
  const workouts = [
    makeWorkout("w1", 10, [{ name: "Deadlift", weight: 315, reps: 5 }]),
    makeWorkout("w2", 5, [{ name: "Deadlift", weight: 335, reps: 3 }]),
    makeWorkout("w3", 2, [{ name: "Deadlift", weight: 320, reps: 2 }]),
  ];

  it("first-ever sessions are baselines, not records", () => {
    const events = prEventsByWorkout([workouts[0]]);
    assert.equal(events.length, 0);
  });

  it("emits a source-linked event when a set beats the prior best", () => {
    const events = prEventsByWorkout(workouts);
    assert.equal(events.length, 1);
    const e = events[0];
    assert.equal(e.workoutId, "w2");
    assert.equal(e.exerciseName, "Deadlift");
    assert.equal(e.beatWeight, true);
    assert.equal(e.weight, 335);
    assert.equal(e.previousWeightLb, 315);
  });

  it("prCountsByWorkout derives from the same events (pills == timeline)", () => {
    const events = prEventsByWorkout(workouts);
    const counts = prCountsByWorkout(workouts);
    for (const w of workouts) {
      assert.equal(
        counts[w.id],
        events.filter((e) => e.workoutId === w.id).length
      );
    }
  });

  it("timed exercises never PR", () => {
    const timed = [
      makeWorkout("t1", 4, [{ name: "Plank", weight: 45, reps: 60, kind: "timed" }]),
      makeWorkout("t2", 1, [{ name: "Plank", weight: 65, reps: 60, kind: "timed" }]),
    ];
    assert.equal(prEventsByWorkout(timed).length, 0);
  });

  it("reconciles PRs across aliases after canonicalization (the FIX-33 wiring)", () => {
    const split = [
      makeWorkout("a1", 10, [{ name: "Bench Press", weight: 185, reps: 5 }]),
      makeWorkout("a2", 5, [{ name: "bench", weight: 205, reps: 4 }]),
    ];
    // Unwired (raw names): "bench" is its own first-ever baseline, no event.
    assert.equal(prEventsByWorkout(split).length, 0);
    // Wired: the 205 lb bench set beats the 185 lb Bench Press history.
    const events = prEventsByWorkout(canonicalizeWorkouts(split));
    assert.equal(events.length, 1);
    assert.equal(events[0].exerciseName, "Barbell Bench Press");
    assert.equal(events[0].workoutId, "a2");
    assert.equal(events[0].previousWeightLb, 185);
  });
});

/* ------------------------------------------------------- alias-aware lookups */

describe("withAliasKeyEchoes", () => {
  const raw = [
    makeWorkout("w1", 6, [{ name: "Bench Press", weight: 185, reps: 5 }]),
    makeWorkout("w2", 2, [{ name: "Barbell Bench Press", weight: 225, reps: 3 }]),
  ];
  const canonical = canonicalizeWorkouts(raw);

  it("raw logged names keep hitting the merged entry", () => {
    const map = withAliasKeyEchoes(lastSetsByExercise(canonical), raw, {});
    const viaRaw = map["bench press"];
    const viaCanonical = map["barbell bench press"];
    assert.ok(viaRaw, "raw key echoes the canonical entry");
    assert.equal(viaRaw, viaCanonical);
    // The merged entry is the most recent session across BOTH variants.
    assert.equal(viaCanonical.sets[0].weight, 225);
  });

  it("never overwrites an existing key and skips unmergeable names", () => {
    const base = { kept: 1 } as Record<string, number>;
    const out = withAliasKeyEchoes(
      base,
      [makeWorkout("w3", 1, [{ name: "Kept", weight: 100, reps: 5 }])],
      {}
    );
    assert.equal(out.kept, 1);
    assert.ok(!("unrelated" in out));
  });
});

/* ---------------------------------------------------------------- frequency */

describe("weeklyFrequencySlots", () => {
  it("bins sessions per trailing 7-day week; empty weeks are truthful zeros", () => {
    const window = windowEndingAt(ANCHOR, 28);
    const sessions = [
      { t: ANCHOR },
      { t: ANCHOR - 2 * DAY_MS },
      { t: ANCHOR - 20 * DAY_MS },
    ];
    const slots = weeklyFrequencySlots(sessions, window);
    assert.equal(slots.length, 4);
    assert.equal(slots.at(-1)?.value, 2);
    assert.equal(slots[1].value, 1);
    assert.equal(slots[0].value, 0);
  });
});

/* ------------------------------------------------------ adherence + milestones */

const SCHEDULE: PlanSchedule = {
  planId: "plan-1",
  sessions: [0, 1, 2].map((position) => ({
    id: `s${position}`,
    position,
    name: `Day ${position + 1}`,
    weekday: null,
    exercises: [],
  })),
};

// Sunday-start week containing the anchor (2026-07-08 is a Wednesday).
const WEEK_START = ANCHOR - 3 * DAY_MS;

describe("weeklyAdherenceSeries + perfectPlanWeekMilestones", () => {
  const weeks = [
    { startMs: WEEK_START - 7 * DAY_MS, endMs: WEEK_START },
    { startMs: WEEK_START, endMs: WEEK_START + 7 * DAY_MS },
  ];
  const completions = [
    // Last week: all three sessions (a perfect week).
    { planSessionId: "s0", completedDayMs: WEEK_START - 6 * DAY_MS },
    { planSessionId: "s1", completedDayMs: WEEK_START - 4 * DAY_MS },
    { planSessionId: "s2", completedDayMs: WEEK_START - 2 * DAY_MS },
    // This week so far: one.
    { planSessionId: "s0", completedDayMs: WEEK_START + 1 * DAY_MS },
  ];

  it("scores each week against the rotation via the ONE adherence semantic", () => {
    const series = weeklyAdherenceSeries({ schedule: SCHEDULE, completions, weeks });
    assert.deepEqual(
      series.map((w) => ({ completed: w.completed, planned: w.planned })),
      [
        { completed: 3, planned: 3 },
        { completed: 1, planned: 3 },
      ]
    );
  });

  it("emits a milestone only for actually-complete weeks", () => {
    const milestones = perfectPlanWeekMilestones({
      schedule: SCHEDULE,
      completions,
      weeks,
    });
    assert.equal(milestones.length, 1);
    assert.equal(milestones[0].kind, "perfect-week");
    assert.equal(milestones[0].detail, "3 of 3 sessions completed");
  });
});

describe("sessionCountMilestones", () => {
  const headers = Array.from({ length: 12 }, (_, i) => ({
    id: `w${i + 1}`,
    performedAt: new Date(ANCHOR - (30 - i) * DAY_MS).toISOString(),
  }));

  it("names each reached threshold and links its source workout", () => {
    const milestones = sessionCountMilestones(headers);
    assert.deepEqual(
      milestones.map((m) => m.id),
      ["session-count-1", "session-count-5", "session-count-10"]
    );
    assert.equal(milestones[0].label, "First workout logged");
    assert.equal(milestones[1].label, "5th workout logged");
    assert.equal(milestones[2].workoutId, "w10");
  });

  it("reports the next milestone ahead honestly", () => {
    assert.deepEqual(nextSessionCountMilestone(12), {
      threshold: 25,
      remaining: 13,
    });
    assert.equal(nextSessionCountMilestone(1000), null);
  });
});

/* -------------------------------------------------- tz bucketing + muscles */

describe("volumeTrend member-local bucketing", () => {
  it("buckets a late-night Chicago session to the member's day, not the UTC day", () => {
    const w: WorkoutData = {
      ...makeWorkout("w1", 0, [{ name: "Deadlift", weight: 315, reps: 5 }]),
      // 03:00 UTC on Jul 9 = 10pm Jul 8 in America/Chicago.
      performedAt: new Date(Date.UTC(2026, 6, 9, 3, 0, 0)).toISOString(),
    };
    const utc = volumeTrend([w]);
    const local = volumeTrend([w], "America/Chicago");
    assert.equal(utc[0].t, Date.UTC(2026, 6, 9));
    assert.equal(local[0].t, Date.UTC(2026, 6, 8));
    assert.equal(utc[0].volume, local[0].volume);
  });
});

describe("muscleGroupDistribution", () => {
  it("counts completed working sets per group, unspecified bucketed honestly", () => {
    const workouts = [
      makeWorkout("w1", 3, [
        { name: "Bench Press", weight: 185, reps: 5, muscleGroup: "chest" },
        { name: "Barbell Row", weight: 155, reps: 8, muscleGroup: "back" },
        { name: "Mystery Move", weight: 50, reps: 10 },
      ]),
      makeWorkout("w2", 1, [
        { name: "Incline Bench Press", weight: 135, reps: 8, muscleGroup: "chest" },
      ]),
    ];
    assert.deepEqual(muscleGroupDistribution(workouts), [
      { muscleGroup: "chest", sets: 2 },
      { muscleGroup: "back", sets: 1 },
      { muscleGroup: "unspecified", sets: 1 },
    ]);
  });
});
