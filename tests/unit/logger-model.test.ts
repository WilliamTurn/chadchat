import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blankSet,
  detectSetPr,
  liveSetProgress,
  liveVolumeLb,
  warmupRamp,
  type EditorExercise,
} from "@/components/workouts/logger/model";
import {
  liftFeasibility,
  parseTargetDate,
  weightFeasibility,
} from "@/lib/goals/feasibility";
import { prBaselineByExercise } from "@/lib/workouts/stats";

describe("warmupRamp", () => {
  it("builds the bar -> 40 -> 60 -> 80 percent ladder, plate-rounded", () => {
    const steps = warmupRamp(185, "lb");
    assert.deepEqual(
      steps.map((s) => s.weight),
      [45, 75, 110, 150]
    );
    assert.deepEqual(
      steps.map((s) => s.reps),
      [10, 5, 3, 1]
    );
  });

  it("returns nothing at or below the empty bar", () => {
    assert.deepEqual(warmupRamp(45, "lb"), []);
    assert.deepEqual(warmupRamp(20, "kg"), []);
  });

  it("skips rungs that collapse into the bar", () => {
    const steps = warmupRamp(60, "lb");
    // 40% of 60 rounds to the bar; only distinct ascending rungs remain.
    for (let i = 1; i < steps.length; i++) {
      assert.ok(steps[i].weight > steps[i - 1].weight);
    }
  });
});

describe("detectSetPr", () => {
  const baseline = { bestWeightLb: 200, bestE1RMLb: 240, bestReps: 12 };

  function set(weight: string, reps: string): ReturnType<typeof blankSet> {
    return { ...blankSet(), weight, reps, completed: true };
  }

  it("flags a heavier-than-ever set", () => {
    assert.equal(detectSetPr(baseline, set("205", "1"), "weighted"), "weight");
  });

  it("flags an est-1RM PR at a lighter weight", () => {
    // 195 x 8 -> Epley e1RM 247 lb, beats 240 without beating best weight.
    assert.equal(detectSetPr(baseline, set("195", "8"), "weighted"), "e1rm");
  });

  it("stays quiet without history, on warmups, and when unchecked", () => {
    assert.equal(detectSetPr(undefined, set("500", "5"), "weighted"), null);
    assert.equal(
      detectSetPr(baseline, { ...set("500", "5"), setType: "warmup" }, "weighted"),
      null
    );
    assert.equal(
      detectSetPr(baseline, { ...set("500", "5"), completed: false }, "weighted"),
      null
    );
  });

  it("flags a rep PR for bodyweight exercises", () => {
    assert.equal(detectSetPr(baseline, set("", "15"), "bodyweight"), "reps");
  });
});

describe("live session math", () => {
  const exercises: EditorExercise[] = [
    {
      uid: "a",
      name: "Bench",
      muscleGroup: "chest",
      kind: "weighted",
      linkedWithPrev: false,
      notes: "",
      sets: [
        { ...blankSet(), weight: "45", reps: "10", setType: "warmup", completed: true },
        { ...blankSet(), weight: "185", reps: "8", completed: true },
        { ...blankSet(), weight: "185", reps: "8", completed: false },
      ],
    },
  ];

  it("volume counts completed non-warmup sets only", () => {
    assert.equal(liveVolumeLb(exercises), 185 * 8);
  });

  it("set progress counts every set incl. warmups", () => {
    assert.deepEqual(liveSetProgress(exercises), { done: 2, total: 3 });
  });
});

describe("prBaselineByExercise", () => {
  it("normalizes kg history to lb for fair comparison", () => {
    const baseline = prBaselineByExercise([
      {
        id: "w1",
        title: "T",
        performedAt: new Date().toISOString(),
        durationSeconds: null,
        notes: null,
        exercises: [
          {
            name: "Squat",
            muscleGroup: "legs",
            kind: "weighted",
            notes: null,
            sets: [
              {
                weight: 100,
                reps: 5,
                unit: "kg",
                rpe: null,
                setType: "working",
                completed: true,
              },
            ],
          },
        ],
      },
    ]);
    // 100 kg = 220.5 lb best weight.
    assert.ok(Math.abs(baseline.squat.bestWeightLb - 220.462) < 0.01);
    assert.ok(baseline.squat.bestE1RMLb > baseline.squat.bestWeightLb);
  });
});

describe("goal feasibility", () => {
  it("parses chip-format dates and rejects free text", () => {
    assert.ok(parseTargetDate("Sep 30, 2026") instanceof Date);
    assert.equal(parseTargetDate("by summer"), null);
    assert.equal(parseTargetDate(""), null);
  });

  it("bands weight-loss pace by percent of bodyweight", () => {
    const soon = new Date(Date.now() + 8 * 7 * 86_400_000).toDateString();
    const extreme = weightFeasibility({ start: 205, target: 180, targetDate: soon });
    assert.equal(extreme?.direction, "lose");
    assert.equal(extreme?.band, "extreme");

    const long = new Date(Date.now() + 30 * 7 * 86_400_000).toDateString();
    const safe = weightFeasibility({ start: 205, target: 180, targetDate: long });
    assert.equal(safe?.band, "safe");
  });

  it("computes without a date and still projects a sustainable landing", () => {
    const f = weightFeasibility({ start: 205, target: 180, targetDate: null });
    assert.equal(f?.ratePerWeek, null);
    assert.ok((f?.sustainableRate ?? 0) > 0);
    assert.ok(f?.sustainableDate instanceof Date);
  });

  it("judges lift targets against strength-gain reality", () => {
    const soon = new Date(Date.now() + 4 * 7 * 86_400_000).toDateString();
    const dream = liftFeasibility({ currentE1rm: 285, target: 365, targetDate: soon });
    assert.equal(dream?.band, "extreme");
    assert.equal(
      liftFeasibility({ currentE1rm: null, target: 365, targetDate: soon }),
      null
    );
    // Already at/above target: nothing to say.
    assert.equal(
      liftFeasibility({ currentE1rm: 400, target: 365, targetDate: soon }),
      null
    );
  });
});
