// Calories-burned Phase 3: the logged-session energy suite. Pins the
// session split (cardio seconds at their MET, the remaining duration as
// strength at 3.5 — never double-counted), the exercise-name snapshot
// round trip ("Rowing machine · Vigorous" → 8.5), and the cardio-only
// display predicate. Run with: pnpm test:unit

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTIVITY_CATALOG,
  ACTIVITY_GROUPS,
  CARDIO_NAME_SEPARATOR,
  cardioExerciseName,
  metForExerciseName,
} from "../../lib/energy/activity-catalog";
import {
  isCardioOnlySession,
  type LoggedSession,
  sessionNetKcal,
} from "../../lib/energy/workout-energy";

/** A timed exercise with one completed set of `seconds`. */
function timed(name: string, seconds: number | null, completed = true) {
  return { name, kind: "timed" as const, sets: [{ reps: seconds, completed }] };
}

function lift(name: string) {
  return {
    name,
    kind: "weighted" as const,
    sets: [{ reps: 8, completed: true }],
  };
}

/* ------------------------------------------------- name snapshot round trip */

test("every catalog label and every variant snapshot resolves to its MET", () => {
  for (const activity of ACTIVITY_CATALOG) {
    assert.equal(
      metForExerciseName(activity.label),
      activity.met,
      `${activity.id}: label does not resolve`
    );
    for (const variant of activity.variants ?? []) {
      const name = cardioExerciseName(activity.id, variant.id);
      assert.ok(name, `${activity.id}/${variant.id}: no snapshot name`);
      assert.equal(
        metForExerciseName(name),
        variant.met,
        `${activity.id}/${variant.id}: snapshot does not round-trip`
      );
    }
  }
});

test("resolution is case-insensitive and library machine names still work", () => {
  assert.equal(metForExerciseName("hiking"), 5.3);
  assert.equal(
    metForExerciseName(`ROWING MACHINE${CARDIO_NAME_SEPARATOR}VIGOROUS`),
    8.5
  );
  // The 4 built-in machine-cardio library rows (exact library casing).
  assert.equal(metForExerciseName("Treadmill Run"), 8.5);
  assert.equal(metForExerciseName("Stair Climber"), 9.0);
});

test("unknown names, variants, and strength lifts resolve to null", () => {
  assert.equal(metForExerciseName("Bench Press"), null);
  assert.equal(metForExerciseName("Underwater basket weaving"), null);
  assert.equal(
    metForExerciseName(`Running${CARDIO_NAME_SEPARATOR}26 mph`),
    null
  );
  assert.equal(cardioExerciseName("running", "26-mph"), null);
  assert.equal(cardioExerciseName("not-real"), null);
});

test("every picker group has at least one activity", () => {
  for (const group of ACTIVITY_GROUPS) {
    assert.ok(
      ACTIVITY_CATALOG.some((a) => a.group === group.id),
      `${group.id}: empty picker section`
    );
  }
});

/* --------------------------------------------------------- session pricing */

test("strength-only session: durationSeconds at MET 3.5 (the plan's example)", () => {
  const session: LoggedSession = {
    durationSeconds: 3600,
    exercises: [lift("Bench Press")],
  };
  assert.equal(sessionNetKcal(session, 90), 225);
});

test("strength session without a duration prices nothing (no line, no guess)", () => {
  assert.equal(
    sessionNetKcal(
      { durationSeconds: null, exercises: [lift("Bench Press")] },
      90
    ),
    null
  );
});

test("cardio-only session (the Add cardio shape): minutes at the variant MET, no strength remainder", () => {
  const name = cardioExerciseName("rowing-machine", "vigorous") as string;
  const session: LoggedSession = {
    durationSeconds: 1800,
    exercises: [timed(name, 1800)],
  };
  // (8.5 − 1) × 90 × 0.5 = 337.5 → 338. The 1800s duration is the cardio
  // itself, never re-priced as lifting.
  assert.equal(sessionNetKcal(session, 90), 338);
});

test("mixed session: cardio seconds at their MET, the rest at 3.5, never overlapping", () => {
  const session: LoggedSession = {
    durationSeconds: 3600,
    exercises: [lift("Bench Press"), timed("Treadmill Run", 1200)],
  };
  // Treadmill: (8.5 − 1) × 90 × (1200/3600) = 225. Strength: 2400s at 3.5
  // → (2.5 × 90 × 2/3) = 150. Total 375.
  assert.equal(sessionNetKcal(session, 90), 375);
});

test("cardio seconds beyond the session duration never go negative on strength", () => {
  const session: LoggedSession = {
    durationSeconds: 600,
    exercises: [lift("Bench Press"), timed("Treadmill Run", 1200)],
  };
  // Strength remainder clamps to 0; only the treadmill prices: 7.5 × 90 ×
  // (1200/3600) = 225.
  assert.equal(sessionNetKcal(session, 90), 225);
});

test("uncompleted and second-less timed sets contribute nothing", () => {
  const session: LoggedSession = {
    durationSeconds: null,
    exercises: [
      timed("Treadmill Run", 1200, false),
      timed("Rowing Machine", null),
    ],
  };
  assert.equal(sessionNetKcal(session, 90), null);
});

test("a timed exercise the catalog does not know is strength work (plank)", () => {
  const session: LoggedSession = {
    durationSeconds: 3600,
    exercises: [timed("Plank", 60)],
  };
  // No catalog match → the whole hour prices at 3.5, like any lift.
  assert.equal(sessionNetKcal(session, 90), 225);
});

test("no weigh-in yet → null for every session shape", () => {
  assert.equal(
    sessionNetKcal(
      { durationSeconds: 3600, exercises: [lift("Bench Press")] },
      null
    ),
    null
  );
  assert.equal(
    sessionNetKcal(
      { durationSeconds: 1800, exercises: [timed("Hiking", 1800)] },
      null
    ),
    null
  );
});

/* ------------------------------------------------------ cardio-only cue */

test("isCardioOnlySession: true for logged cardio, false once a lift appears", () => {
  const run: LoggedSession = {
    durationSeconds: 1800,
    exercises: [timed(cardioExerciseName("running", "6-mph") as string, 1800)],
  };
  assert.equal(isCardioOnlySession(run), true);
  assert.equal(
    isCardioOnlySession({
      durationSeconds: 1800,
      exercises: [...run.exercises, lift("Bench Press")],
    }),
    false
  );
  assert.equal(
    isCardioOnlySession({ durationSeconds: 1800, exercises: [] }),
    false
  );
  // Timed but unknown to the catalog (plank) is not cardio.
  assert.equal(
    isCardioOnlySession({
      durationSeconds: null,
      exercises: [timed("Plank", 60)],
    }),
    false
  );
});
