import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reducer,
  type State,
} from "@/components/workouts/v2/store";
import type {
  ActiveSession,
  SessionExercise,
  SessionSet,
} from "@/components/workouts/v2/types";

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
    restSeconds: 0,
    note: null,
    targetLabel: null,
    sets: [],
    ...over,
  };
}

function state(exercises: SessionExercise[]): State {
  const session: ActiveSession = {
    id: "session-1",
    name: "Push Day",
    templateId: null,
    createdAt: 0,
    timer: { running: false, accumulatedMs: 0, startedAt: null },
    unit: "lb",
    notes: "",
    exercises,
  };
  return { session, restTimer: null, draft: null };
}

function sets(s: State, wexIndex = 0): SessionSet[] {
  const sess = s.session;
  assert.ok(sess);
  return sess.exercises[wexIndex].sets;
}

describe("uncomplete-all-sets", () => {
  it("un-checks every set of one exercise without touching numbers or the other exercise", () => {
    const a = exercise({
      sets: [
        set({ completed: true, weight: 185, reps: 5, rpe: 8 }),
        set({ completed: true, weight: 190, reps: 3 }),
      ],
    });
    const b = exercise({
      name: "Squat",
      sets: [set({ completed: true, weight: 225, reps: 5 })],
    });
    const next = reducer(state([a, b]), {
      type: "uncomplete-all-sets",
      wexId: a.id,
    });
    for (const row of sets(next, 0)) {
      assert.equal(row.completed, false);
      assert.equal(row.prs, undefined);
    }
    assert.equal(sets(next, 0)[0].weight, 185);
    assert.equal(sets(next, 0)[0].reps, 5);
    assert.equal(sets(next, 0)[0].rpe, 8);
    assert.equal(sets(next, 0)[1].weight, 190);
    assert.equal(sets(next, 1)[0].completed, true, "other exercise untouched");
  });

  it("session-wide (no wexId) un-checks everything and clears prs", () => {
    const a = exercise({
      sets: [set({ completed: true, prs: ["heaviest-weight"] })],
    });
    const b = exercise({ name: "Squat", sets: [set({ completed: true })] });
    const next = reducer(state([a, b]), { type: "uncomplete-all-sets" });
    assert.equal(sets(next, 0)[0].completed, false);
    assert.equal(sets(next, 0)[0].prs, undefined);
    assert.equal(sets(next, 1)[0].completed, false);
  });

  it("keeps prAnnounced so a re-check can't re-fire the PR toast", () => {
    const a = exercise({
      sets: [
        set({ completed: true, prs: ["heaviest-weight"], prAnnounced: true }),
      ],
    });
    const cleared = reducer(state([a]), {
      type: "uncomplete-all-sets",
      wexId: a.id,
    });
    const row = sets(cleared, 0)[0];
    assert.equal(row.completed, false);
    assert.equal(row.prs, undefined);
    assert.equal(row.prAnnounced, true, "announcement memory survives unmark");
  });
});

describe("PR announcement memory (set-completed / complete-all-sets)", () => {
  it("checking a set with PRs records prAnnounced; unchecking keeps it", () => {
    const a = exercise({ sets: [set()] });
    const setId = a.sets[0].id;
    const checked = reducer(state([a]), {
      type: "set-completed",
      wexId: a.id,
      setId,
      completed: true,
      prs: ["heaviest-weight"],
      now: 1000,
    });
    assert.equal(sets(checked, 0)[0].prAnnounced, true);
    const unchecked = reducer(checked, {
      type: "set-completed",
      wexId: a.id,
      setId,
      completed: false,
      now: 2000,
    });
    assert.equal(sets(unchecked, 0)[0].completed, false);
    assert.equal(sets(unchecked, 0)[0].prs, undefined);
    assert.equal(sets(unchecked, 0)[0].prAnnounced, true);
  });

  it("checking with no PRs leaves prAnnounced unset", () => {
    const a = exercise({ sets: [set()] });
    const checked = reducer(state([a]), {
      type: "set-completed",
      wexId: a.id,
      setId: a.sets[0].id,
      completed: true,
      prs: [],
      now: 1000,
    });
    assert.ok(!sets(checked, 0)[0].prAnnounced);
  });

  it("complete-all-sets marks prAnnounced only on sets that got PRs", () => {
    const a = exercise({ sets: [set(), set()] });
    const [pr, plain] = a.sets;
    const next = reducer(state([a]), {
      type: "complete-all-sets",
      prsBySetId: { [pr.id]: ["best-est-1rm"] },
    });
    assert.equal(sets(next, 0)[0].prAnnounced, true);
    assert.deepEqual(sets(next, 0)[0].prs, ["best-est-1rm"]);
    assert.ok(!sets(next, 0)[1].prAnnounced);
  });

  it("per-exercise complete-all-sets touches only its exercise", () => {
    const a = exercise({ sets: [set()] });
    const b = exercise({ name: "Squat", sets: [set()] });
    const next = reducer(state([a, b]), {
      type: "complete-all-sets",
      wexId: a.id,
      prsBySetId: {},
    });
    assert.equal(sets(next, 0)[0].completed, true);
    assert.equal(sets(next, 1)[0].completed, false);
  });
});

describe("reorder-session-exercise", () => {
  const names = (s: State) => {
    const sess = s.session;
    assert.ok(sess);
    return sess.exercises.map((e) => e.name);
  };

  it("moves an exercise from position 1 to 4 in one action", () => {
    const list = ["A", "B", "C", "D", "E"].map((name) => exercise({ name }));
    const next = reducer(state(list), {
      type: "reorder-session-exercise",
      wexId: list[0].id,
      toIndex: 3,
    });
    assert.deepEqual(names(next), ["B", "C", "D", "A", "E"]);
  });

  it("clamps an out-of-range target and ignores unknown ids", () => {
    const list = ["A", "B"].map((name) => exercise({ name }));
    const clamped = reducer(state(list), {
      type: "reorder-session-exercise",
      wexId: list[0].id,
      toIndex: 99,
    });
    assert.deepEqual(names(clamped), ["B", "A"]);
    const untouched = reducer(state(list), {
      type: "reorder-session-exercise",
      wexId: "nope",
      toIndex: 1,
    });
    assert.deepEqual(names(untouched), ["A", "B"]);
  });
});
