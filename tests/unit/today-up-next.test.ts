/**
 * /home Up-next selector tests (FIX-23, P56-D). The verdict must follow the
 * fixed priority order, be deterministic, and be safe when data is missing.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UpNextVerdict } from "../../lib/plans/up-next";
import {
  selectUpNextToday,
  type UpNextSnapshot,
} from "../../lib/today/up-next";

function trainingVerdict(name = "Day 2: Lower"): UpNextVerdict {
  return {
    session: {
      id: "s2",
      position: 1,
      name,
      weekday: null,
      exercises: [
        {
          name: "Squat",
          sets: 3,
          reps: "5",
          weight: null,
          unit: "lb",
          note: null,
          restSeconds: null,
          supersetGroup: null,
          setPrescriptions: [],
        },
      ],
    },
    reason: "Your least recent workout in the rotation.",
  };
}

function snap(overrides: Partial<UpNextSnapshot>): UpNextSnapshot {
  return {
    training: null,
    lastNightLogged: true,
    hasMealPlan: false,
    mealsLoggedToday: 0,
    isPro: true,
    ...overrides,
  };
}

const ROTATION = [
  { name: "Day 1: Upper", completedThisWeek: true },
  { name: "Day 2: Lower", completedThisWeek: false },
];

describe("selectUpNextToday", () => {
  it("training outranks everything when a session is due", () => {
    const v = selectUpNextToday(
      snap({
        training: {
          planId: "p1",
          planTitle: "PPL",
          verdict: trainingVerdict(),
          trainedToday: false,
          rotation: ROTATION,
        },
        lastNightLogged: false,
        hasMealPlan: true,
      })
    );
    assert.equal(v.kind, "training");
    assert.equal(v.title, "Start Day 2: Lower");
    assert.equal(v.cta.href, "/workouts");
    assert.equal(v.secondary?.href, "/plans/p1");
    assert.deepEqual(v.training?.exercises, ["Squat"]);
    // The WHY comes from the P34-D selector, never re-derived here.
    assert.equal(v.reason, "Your least recent workout in the rotation.");
  });

  it("skips training once today's session is completed", () => {
    const v = selectUpNextToday(
      snap({
        training: {
          planId: "p1",
          planTitle: "PPL",
          verdict: trainingVerdict(),
          trainedToday: true,
          rotation: ROTATION,
        },
        lastNightLogged: false,
      })
    );
    assert.equal(v.kind, "sleep");
    assert.match(v.reason, /workout is done/i);
  });

  it("sleep repair outranks the meal plan", () => {
    const v = selectUpNextToday(
      snap({ lastNightLogged: false, hasMealPlan: true })
    );
    assert.equal(v.kind, "sleep");
    assert.equal(v.cta.href, "/sleep");
  });

  it("meal plan fires only when nothing is logged today", () => {
    const yes = selectUpNextToday(
      snap({ hasMealPlan: true, mealsLoggedToday: 0 })
    );
    assert.equal(yes.kind, "meal-plan");
    assert.equal(yes.cta.href, "/nutrition#log-meal");

    const no = selectUpNextToday(
      snap({ hasMealPlan: true, mealsLoggedToday: 2 })
    );
    assert.equal(no.kind, "review");
  });

  it("falls back to review when the day is handled", () => {
    const v = selectUpNextToday(snap({}));
    assert.equal(v.kind, "review");
    assert.equal(v.cta.href, "/progress");
    assert.ok(v.reason.length > 0);
  });

  it("is safe with everything missing (no plan, nothing logged, not Pro)", () => {
    const v = selectUpNextToday(
      snap({ isPro: false, lastNightLogged: false, hasMealPlan: true })
    );
    // Below Pro there is no sleep/meal logging; the day is chat + review.
    assert.equal(v.kind, "review");
    assert.ok(v.cta.href);
  });

  it("is deterministic: same snapshot, same verdict", () => {
    const s = snap({
      training: {
        planId: "p1",
        planTitle: "PPL",
        verdict: trainingVerdict(),
        trainedToday: false,
        rotation: ROTATION,
      },
    });
    assert.deepEqual(selectUpNextToday(s), selectUpNextToday(s));
  });

  it("a document-only plan (null verdict) degrades to the next priority", () => {
    const v = selectUpNextToday(
      snap({
        training: {
          planId: "p1",
          planTitle: "Notes plan",
          verdict: null,
          trainedToday: false,
          rotation: [],
        },
        lastNightLogged: false,
      })
    );
    assert.equal(v.kind, "sleep");
  });
});
