/**
 * Goal-outcome resolution tests (FIX-29). Every goal resolves to typed
 * outcomes: registered-metric outcomes are supported, everything else is
 * EXPLICITLY unsupported (never silently dropped, never fake-supported),
 * and legacy single-metric goals adapt without their rows being rewritten.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Goal, GoalOutcome } from "../../lib/db/schema";
import {
  isRegisteredMetricId,
  legacyGoalOutcome,
  outcomeRowToView,
  resolveGoalOutcomes,
} from "../../lib/goals/outcomes";
import { goalOutcomeSchema } from "../../lib/validation/goals";

function legacyGoal(overrides: Partial<Goal>): Goal {
  return {
    id: "goal-1",
    userId: "user-1",
    title: "Lose 15 lb",
    detail: "",
    targetDate: null,
    status: "active",
    source: "user",
    sourceChatId: null,
    metric: null,
    metricRef: null,
    startValue: null,
    currentValue: null,
    targetValue: null,
    unit: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as Goal;
}

function outcomeRow(overrides: Partial<GoalOutcome>): GoalOutcome {
  return {
    id: "outcome-1",
    goalId: "goal-1",
    userId: "user-1",
    position: 0,
    metricId: null,
    metricRef: null,
    label: null,
    startValue: null,
    targetValue: null,
    currentValue: null,
    unit: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as GoalOutcome;
}

describe("legacyGoalOutcome", () => {
  it("maps weight goals to the canonical trend-weight metric (LC-4)", () => {
    const view = legacyGoalOutcome(
      legacyGoal({ metric: "weight", startValue: 205, targetValue: 180, unit: "lb" })
    );
    assert.equal(view?.supported, true);
    assert.equal(view?.metricId, "body.weight.trend");
    assert.equal(view?.startValue, 205);
    assert.equal(view?.targetValue, 180);
    // Supported outcomes never carry a manual current value.
    assert.equal(view?.currentValue, null);
  });

  it("maps lift goals to est. 1RM with the exercise as metricRef", () => {
    const view = legacyGoalOutcome(
      legacyGoal({ metric: "lift", metricRef: "Back Squat", targetValue: 315 })
    );
    assert.equal(view?.metricId, "training.exercise.e1rm");
    assert.equal(view?.metricRef, "Back Squat");
    assert.equal(view?.label, "Back Squat est. 1RM");
  });

  it("marks bodyfat and custom goals explicitly unsupported with manual current", () => {
    const bodyfat = legacyGoalOutcome(
      legacyGoal({ metric: "bodyfat", currentValue: 22, targetValue: 15 })
    );
    assert.equal(bodyfat?.supported, false);
    assert.equal(bodyfat?.metricId, null);
    assert.equal(bodyfat?.label, "Body fat %");
    assert.equal(bodyfat?.currentValue, 22);

    const custom = legacyGoalOutcome(legacyGoal({ metric: "custom" }));
    assert.equal(custom?.supported, false);
  });

  it("returns null for a goal with no measurable outcome", () => {
    assert.equal(legacyGoalOutcome(legacyGoal({ metric: null })), null);
  });
});

describe("resolveGoalOutcomes", () => {
  it("prefers outcome rows over the legacy columns", () => {
    const views = resolveGoalOutcomes(
      legacyGoal({ metric: "weight", targetValue: 180 }),
      [
        outcomeRow({ metricId: "body.weight.trend", targetValue: 178 }),
        outcomeRow({
          id: "outcome-2",
          position: 1,
          metricId: "training.exercise.e1rm",
          metricRef: "Barbell Bench Press",
          targetValue: 225,
        }),
      ]
    );
    assert.equal(views.length, 2);
    assert.equal(views[0].source, "outcome-row");
    assert.equal(views[0].targetValue, 178);
    assert.equal(views[1].label, "Barbell Bench Press est. 1RM");
  });

  it("falls back to the adapted legacy metric when no rows exist", () => {
    const views = resolveGoalOutcomes(
      legacyGoal({ metric: "weight", targetValue: 180 }),
      []
    );
    assert.equal(views.length, 1);
    assert.equal(views[0].source, "legacy-goal");
  });

  it("degrades an unknown stored metricId to unsupported, never a crash", () => {
    const view = outcomeRowToView(
      outcomeRow({ metricId: "body.weight.retired", label: "Old metric" })
    );
    assert.equal(view.supported, false);
    assert.equal(view.metricId, null);
    assert.equal(view.label, "Old metric");
  });
});

describe("goalOutcomeSchema (validation)", () => {
  it("accepts a registered metric id", () => {
    assert.equal(
      goalOutcomeSchema.safeParse({ metricId: "body.weight.trend" }).success,
      true
    );
  });

  it("rejects an unregistered metric id", () => {
    assert.equal(
      goalOutcomeSchema.safeParse({ metricId: "made.up.metric" }).success,
      false
    );
  });

  it("requires a label for explicitly-unsupported outcomes", () => {
    assert.equal(goalOutcomeSchema.safeParse({ metricId: null }).success, false);
    assert.equal(
      goalOutcomeSchema.safeParse({ metricId: null, label: "Body fat %" })
        .success,
      true
    );
  });
});

describe("isRegisteredMetricId", () => {
  it("matches the metric registry exactly", () => {
    assert.equal(isRegisteredMetricId("training.sessions.thisWeek"), true);
    assert.equal(isRegisteredMetricId("training.sessions"), false);
  });
});
