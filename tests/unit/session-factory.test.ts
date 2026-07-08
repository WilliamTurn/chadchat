import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectPRs,
  exerciseFromRef,
  serializeSession,
  sessionFromTemplate,
} from "@/components/workouts/v2/session-factory";
import type {
  ActiveSession,
  SessionExercise,
  SessionSet,
} from "@/components/workouts/v2/types";
import { prCountsByWorkout, type WorkoutData } from "@/lib/workouts/stats";

function set(over: Partial<SessionSet> = {}): SessionSet {
  return {
    id: `set-${Math.random()}`,
    type: "working",
    weight: 100,
    reps: 8,
    rpe: null,
    completed: false,
    ...over,
  };
}

function exercise(over: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: `wex-${Math.random()}`,
    name: "Barbell Bench Press",
    muscleGroup: "chest",
    equipment: "barbell",
    kind: "weighted",
    restSeconds: 120,
    note: null,
    targetLabel: null,
    sets: [],
    ...over,
  };
}

function session(exercises: SessionExercise[]): ActiveSession {
  return {
    id: "session-1",
    name: "Push Day",
    templateId: null,
    createdAt: new Date(2026, 6, 8, 9, 30).getTime(),
    timer: { running: false, accumulatedMs: 0, startedAt: null },
    unit: "lb",
    notes: "",
    exercises,
  };
}

describe("serializeSession", () => {
  it("keeps only exercises with completed sets, and only their completed sets", () => {
    const s = session([
      exercise({ sets: [set({ completed: true }), set()] }),
      exercise({ name: "Overhead Press", sets: [set()] }),
    ]);
    const payload = serializeSession(s, 600);
    assert.ok(payload);
    assert.equal(payload.exercises.length, 1);
    assert.equal(payload.exercises[0].sets.length, 1);
    assert.equal(payload.durationSeconds, 600);
  });

  it("returns null when nothing was completed", () => {
    const s = session([exercise({ sets: [set()] })]);
    assert.equal(serializeSession(s, 0), null);
  });

  it("keeps completed sets even with no weight or reps (Done without numbers)", () => {
    const s = session([
      exercise({ sets: [set({ weight: null, reps: null, completed: true })] }),
    ]);
    const payload = serializeSession(s, 0);
    assert.ok(payload);
    assert.equal(payload.exercises[0].sets[0].weight, null);
    assert.equal(payload.exercises[0].sets[0].reps, null);
    assert.equal(payload.exercises[0].sets[0].completed, true);
    // No timer used -> no duration recorded.
    assert.equal(payload.durationSeconds, null);
  });

  it("stamps performedAt as the local calendar day of session start", () => {
    const payload = serializeSession(
      session([exercise({ sets: [set({ completed: true })] })]),
      60
    );
    assert.equal(payload?.performedAt, "2026-07-08");
  });
});

describe("detectPRs", () => {
  const bench = exercise();

  it("returns nothing when the exercise has no history (baseline, not a record)", () => {
    const prs = detectPRs({}, bench, set({ weight: 500, reps: 5 }), "lb");
    assert.deepEqual(prs, []);
  });

  it("flags heavier-than-ever weight and better est. 1RM", () => {
    const baseline = {
      "barbell bench press": { bestWeightLb: 200, bestE1RMLb: 220, bestReps: 8 },
    };
    const prs = detectPRs(baseline, bench, set({ weight: 225, reps: 3 }), "lb");
    assert.ok(prs.includes("heaviest-weight"));
    const modest = detectPRs(baseline, bench, set({ weight: 150, reps: 5 }), "lb");
    assert.deepEqual(modest, []);
  });

  it("never flags warm-ups or timed work", () => {
    const baseline = {
      "barbell bench press": { bestWeightLb: 100, bestE1RMLb: 100, bestReps: 8 },
    };
    assert.deepEqual(
      detectPRs(baseline, bench, set({ weight: 500, reps: 5, type: "warmup" }), "lb"),
      []
    );
    const plank = exercise({ name: "Plank", kind: "timed" });
    assert.deepEqual(
      detectPRs(
        { plank: { bestWeightLb: 1, bestE1RMLb: 1, bestReps: 1 } },
        plank,
        set({ weight: 10, reps: 60 }),
        "lb"
      ),
      []
    );
  });
});

describe("exerciseFromRef", () => {
  it("prefills working sets from the last session of that exercise", () => {
    const ex = exerciseFromRef(
      {
        name: "Barbell Bench Press",
        muscleGroup: "chest",
        equipment: "barbell",
        kind: "weighted",
      },
      {
        "barbell bench press": {
          performedAt: "2026-07-01T12:00:00.000Z",
          sets: [
            { weight: 185, reps: 8, unit: "lb" },
            { weight: 185, reps: 7, unit: "lb" },
          ],
        },
      }
    );
    assert.equal(ex.sets.length, 3);
    assert.equal(ex.sets[0].weight, 185);
    assert.equal(ex.sets[0].reps, 8);
    // Sets past the history length repeat the last known set.
    assert.equal(ex.sets[2].reps, 7);
    assert.ok(ex.sets.every((s) => !s.completed));
  });

  it("skips ghost sets that were logged without any numbers", () => {
    const ex = exerciseFromRef(
      {
        name: "Overhead Press",
        muscleGroup: "shoulders",
        equipment: "barbell",
        kind: "weighted",
      },
      {
        "overhead press": {
          performedAt: "2026-07-01T12:00:00.000Z",
          sets: [
            { weight: 95, reps: 10, unit: "lb" },
            { weight: null, reps: null, unit: "lb" },
          ],
        },
      }
    );
    assert.ok(ex.sets.every((s) => s.weight === 95 && s.reps === 10));
  });
});

describe("sessionFromTemplate", () => {
  it("builds a paused session (the clock NEVER starts on its own)", () => {
    const s = sessionFromTemplate(
      {
        id: "t1",
        name: "Push Day",
        exercises: [
          {
            name: "Barbell Bench Press",
            muscleGroup: "chest",
            kind: "weighted",
            equipment: "barbell",
            targetSets: 3,
            repRangeMin: 8,
            repRangeMax: 12,
            restSeconds: 120,
            note: null,
          },
        ],
      },
      {},
      "lb"
    );
    assert.equal(s.timer.running, false);
    assert.equal(s.timer.accumulatedMs, 0);
    assert.equal(s.timer.startedAt, null);
    assert.equal(s.templateId, "t1");
    assert.equal(s.exercises[0].sets.length, 3);
  });
});

describe("prCountsByWorkout", () => {
  it("counts records against prior sessions only (first time = baseline)", () => {
    const mk = (id: string, performedAt: string, weight: number): WorkoutData => ({
      id,
      title: "W",
      performedAt,
      durationSeconds: null,
      notes: null,
      exercises: [
        {
          name: "Bench",
          muscleGroup: null,
          kind: "weighted",
          supersetGroup: null,
          notes: null,
          sets: [
            {
              weight,
              reps: 5,
              unit: "lb",
              rpe: null,
              setType: "working",
              completed: true,
            },
          ],
        },
      ],
    });
    const counts = prCountsByWorkout([
      mk("a", "2026-07-01T12:00:00.000Z", 200),
      mk("b", "2026-07-05T12:00:00.000Z", 225),
      mk("c", "2026-07-07T12:00:00.000Z", 210),
    ]);
    assert.equal(counts.a, 0); // first ever: baseline
    assert.equal(counts.b, 1); // beat 200
    assert.equal(counts.c, 0); // under the 225 best
  });
});
