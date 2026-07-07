// FEAT-21 quit-date heuristics. Run with: pnpm test:unit
//
// The prediction layer is deterministic by design (the model never picks the
// date). These tests pin the bounds, the de-rounding rule (no date lands on a
// multiple of 5 or 7, so every verdict reads specific, not round), the
// direction of every modifier, and the failure-mode labels.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APPS_TRIED_VALUES,
  type AutopsyAnswers,
  failureModeFor,
  KILLER_VALUES,
  LIFE_LOAD_VALUES,
  MAX_QUIT_DAY,
  MIN_QUIT_DAY,
  predictQuitDay,
  RESTART_VALUES,
  STREAK_VALUES,
} from "../../lib/quit/heuristics";

type Inputs = Pick<
  AutopsyAnswers,
  "appsTried" | "restarts" | "longestStreak" | "lifeLoad"
>;

function answers(over: Partial<Inputs> = {}): Inputs {
  return {
    appsTried: "1-2",
    restarts: "2-3",
    longestStreak: "3-4w",
    lifeLoad: "normal",
    ...over,
  };
}

test("every combination stays inside the window and never lands round", () => {
  const trainingDays = [null, 1, 2, 3, 4, 5, 6, 7];
  for (const appsTried of APPS_TRIED_VALUES) {
    for (const restarts of RESTART_VALUES) {
      for (const longestStreak of STREAK_VALUES) {
        for (const lifeLoad of LIFE_LOAD_VALUES) {
          for (const days of trainingDays) {
            const day = predictQuitDay(
              { appsTried, restarts, longestStreak, lifeLoad },
              days
            );
            assert.ok(day >= MIN_QUIT_DAY, `day ${day} below floor`);
            assert.ok(day <= MAX_QUIT_DAY, `day ${day} above ceiling`);
            assert.notEqual(day % 5, 0, `day ${day} divisible by 5`);
            assert.notEqual(day % 7, 0, `day ${day} divisible by 7`);
          }
        }
      }
    }
  }
});

test("deterministic: same answers, same date", () => {
  const a = answers();
  assert.equal(predictQuitDay(a, 4), predictQuitDay(a, 4));
});

test("the serial quitter gets an earlier date than the proven streak-holder", () => {
  const serialQuitter = predictQuitDay(
    answers({
      appsTried: "6+",
      restarts: "lost-count",
      longestStreak: "under-1w",
      lifeLoad: "chaos",
    }),
    2
  );
  const veteran = predictQuitDay(
    answers({
      appsTried: "none",
      restarts: "first-time",
      longestStreak: "3m-plus",
      lifeLoad: "calm",
    }),
    5
  );
  assert.ok(
    serialQuitter < veteran,
    `expected ${serialQuitter} < ${veteran}`
  );
  // The worst confession pins to the de-rounded floor.
  assert.equal(serialQuitter, 11);
});

test("each modifier moves the date in its documented direction", () => {
  const base = answers();
  assert.ok(
    predictQuitDay({ ...base, lifeLoad: "chaos" }, null) <
      predictQuitDay({ ...base, lifeLoad: "calm" }, null)
  );
  assert.ok(
    predictQuitDay({ ...base, longestStreak: "under-1w" }, null) <
      predictQuitDay({ ...base, longestStreak: "3m-plus" }, null)
  );
  assert.ok(
    predictQuitDay({ ...base, restarts: "lost-count" }, null) <
      predictQuitDay({ ...base, restarts: "first-time" }, null)
  );
  assert.ok(
    predictQuitDay({ ...base, appsTried: "6+" }, null) <
      predictQuitDay({ ...base, appsTried: "none" }, null)
  );
});

test("planning under 3 training days a week pulls the date in", () => {
  const base = answers();
  const low = predictQuitDay(base, 2);
  const mid = predictQuitDay(base, 3);
  const high = predictQuitDay(base, 5);
  assert.ok(low < mid, `expected ${low} < ${mid}`);
  assert.ok(mid <= high, `expected ${mid} <= ${high}`);
  // Unknown commitment is treated as neutral, not punished.
  assert.equal(predictQuitDay(base, null), mid);
});

test("every killer maps to a failure-mode label", () => {
  for (const killer of KILLER_VALUES) {
    const mode = failureModeFor(killer);
    assert.ok(mode.length > 0);
  }
  assert.equal(
    failureModeFor("work"),
    "Work gets busy, one skipped week becomes forever"
  );
});
