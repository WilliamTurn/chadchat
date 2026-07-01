// DSH-26 regression test. Run with: pnpm test:unit
//
// Guards the "same goal, two different percentages" trust bug from the athlete
// audit: `/today` showed 26% and `/progress` showed 38% for the SAME weight goal
// because the two screens anchored the calc on different start weights (the
// goal's stored start vs. the first-ever weigh-in). Both screens now call
// `computeGoalProgress`, so this test pins the shared contract.

import assert from "node:assert/strict";
import { test } from "node:test";
import { computeGoalProgress } from "../../lib/goals/progress";

test("both screens agree when anchored on the goal's stored start weight", () => {
  // The athlete's real numbers: goal created at 205, now 198.6, target 180.
  const goal = {
    startValue: 205,
    targetValue: 180,
    current: 198.6,
    // A first weigh-in EARLIER than the goal (they'd already dropped from 212)
    // — the old bug used this as the anchor and got a different %.
    firstWeight: 212.4,
  };
  const p = computeGoalProgress(goal);
  assert.ok(p);
  // (205 - 198.6) / (205 - 180) = 6.4 / 25 = 25.6% → 26%, NOT 38%.
  assert.equal(p.pct, 26);
  assert.equal(p.toGo, 18.6);
  assert.equal(p.sinceStart, -6.4);
  assert.equal(p.reached, false);
});

test("falls back to the first weigh-in when the goal has no stored start", () => {
  const p = computeGoalProgress({
    startValue: null,
    targetValue: 180,
    current: 198.6,
    firstWeight: 212.4,
  });
  assert.ok(p);
  // Anchored on 212.4: (212.4 - 198.6) / (212.4 - 180) = 13.8 / 32.4 = 42.6% → 43%.
  assert.equal(p.pct, 43);
});

test("handles a weight-GAIN goal (target above start)", () => {
  const p = computeGoalProgress({
    startValue: 150,
    targetValue: 170,
    current: 160,
  });
  assert.ok(p);
  assert.equal(p.pct, 50); // (160-150)/(170-150)
  assert.equal(p.toGo, 10);
  assert.equal(p.sinceStart, 10);
});

test("clamps to 0–100 and marks reached at/over the target", () => {
  // Overshot the loss target.
  const over = computeGoalProgress({
    startValue: 205,
    targetValue: 180,
    current: 178,
  });
  assert.ok(over);
  assert.equal(over.pct, 100);
  assert.equal(over.reached, true);

  // Moved the wrong way — never negative.
  const wrongWay = computeGoalProgress({
    startValue: 205,
    targetValue: 180,
    current: 210,
  });
  assert.ok(wrongWay);
  assert.equal(wrongWay.pct, 0);
  assert.equal(wrongWay.reached, false);
});

test("returns null when there's nothing to compute", () => {
  assert.equal(
    computeGoalProgress({ startValue: 205, targetValue: null, current: 198 }),
    null
  );
  assert.equal(
    computeGoalProgress({ startValue: 205, targetValue: 180, current: null }),
    null
  );
});
