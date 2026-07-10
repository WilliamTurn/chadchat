// FEAT-30 (goal pace) regression tests. Run with: pnpm test:unit
//
// Pins the owner-directed timeline contract (s176): the member's own goal
// date is the Future You timeline anchor, whether that's 8 weeks or 10 years;
// physiology only acts as a validator that extends an impossible date to the
// earliest defensible one (memberDateTooFast). Goals with no usable date keep
// the original computed-honest-pace behavior, including the 6..156 clamps.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Goal, User } from "../../lib/db/schema";
import {
  dateWeeksFromNow,
  formatTargetDate,
  goalPaceLine,
  parseTargetDate,
} from "../../lib/goals/feasibility";
import { buildMilestonePlan } from "../../lib/future-you/milestones";

const user = {
  experienceLevel: "beginner",
  primaryGoal: "fat_loss",
} as unknown as User;

function weightGoal(overrides: Partial<Goal>): Goal {
  return {
    title: "Lose it",
    detail: "",
    metric: "weight",
    startValue: 280,
    targetValue: 178,
    unit: "lb",
    targetDate: null,
    ...overrides,
  } as Goal;
}

test("a member's long date is honored, even past the old 3-year cap", () => {
  // The 102 lb / 10 years scenario from the owner brief.
  const tenYears = formatTargetDate(dateWeeksFromNow(520));
  const plan = buildMilestonePlan({
    goal: weightGoal({ targetDate: tenYears }),
    user,
    currentWeight: 280,
  });
  assert.equal(plan.paceSource, "member-date");
  assert.equal(plan.memberDateTooFast, false);
  assert.ok(plan.totalWeeks >= 519 && plan.totalWeeks <= 521);
  // The pace is THEIR stroll (~0.2 lb/week), not a sprint then flatline.
  assert.ok((plan.weeklyRate as number) <= 0.3);
  assert.equal(plan.paceBand, "gentle");
  // Final frame is the goal, on their date.
  const last = plan.checkpoints.at(-1);
  assert.equal(last?.weekOffset, plan.totalWeeks);
  assert.equal(last?.expectedWeight, 178);
});

test("an impossible date extends to the earliest defensible one and says so", () => {
  // 102 lb down in 4 weeks: physiology caps loss at 1.5% BW/week (4.2 lb at
  // 280), so the earliest defensible finish is ceil(102/4.2) = 25 weeks.
  const fourWeeks = formatTargetDate(dateWeeksFromNow(4));
  const plan = buildMilestonePlan({
    goal: weightGoal({ targetDate: fourWeeks }),
    user,
    currentWeight: 280,
  });
  assert.equal(plan.paceSource, "member-date");
  assert.equal(plan.memberDateTooFast, true);
  assert.equal(plan.totalWeeks, 25);
  assert.equal(plan.paceBand, "aggressive");
});

test("a reasonable member date between the extremes is used exactly", () => {
  const year = formatTargetDate(dateWeeksFromNow(52));
  const plan = buildMilestonePlan({
    goal: weightGoal({ targetDate: year }),
    user,
    currentWeight: 280,
  });
  assert.equal(plan.paceSource, "member-date");
  assert.equal(plan.memberDateTooFast, false);
  assert.ok(plan.totalWeeks >= 51 && plan.totalWeeks <= 53);
  // ~102/52 = ~2 lb/week: 0.7% of 280 = standard.
  assert.equal(plan.paceBand, "standard");
});

test("no usable date keeps the computed honest pace and the 6..156 clamps", () => {
  const plan = buildMilestonePlan({
    goal: weightGoal({ targetDate: "by summer" }),
    user,
    currentWeight: 280,
  });
  assert.equal(plan.paceSource, "computed");
  assert.equal(plan.memberDateTooFast, false);
  // 0.8% of 280 = 2.24 lb/week -> ceil(102/2.24) = 46 weeks.
  assert.equal(plan.totalWeeks, 46);
});

test("a date already in the past is stale and falls back to computed", () => {
  const plan = buildMilestonePlan({
    goal: weightGoal({ targetDate: "Jan 5, 2020" }),
    user,
    currentWeight: 280,
  });
  assert.equal(plan.paceSource, "computed");
});

test("a qualitative goal uses the member's window when a date is set", () => {
  const sixMonths = formatTargetDate(dateWeeksFromNow(26));
  const plan = buildMilestonePlan({
    goal: weightGoal({
      metric: "custom",
      startValue: null,
      targetValue: null,
      targetDate: sixMonths,
    }),
    user,
    currentWeight: null,
  });
  assert.equal(plan.paceSource, "member-date");
  assert.ok(plan.totalWeeks >= 25 && plan.totalWeeks <= 27);
  assert.equal(plan.weeklyRate, null);
  assert.equal(plan.paceBand, null);
});

test("parseTargetDate reads a native date-input value as LOCAL midnight", () => {
  const d = parseTargetDate("2026-09-30");
  assert.ok(d);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 30);
  // And the round-trip through the display format never shifts a day.
  assert.equal(formatTargetDate(d), "Sep 30, 2026");
});

test("goalPaceLine flags an impossible pace and offers the honest landing", () => {
  const line = goalPaceLine({
    metric: "weight",
    startValue: 280,
    targetValue: 178,
    unit: "lb",
    targetDate: formatTargetDate(dateWeeksFromNow(4)),
  });
  assert.ok(line);
  assert.match(line, /faster than a body can actually deliver/);
  assert.match(line, /renegotiate the date/);
});

test("goalPaceLine asks for a date when none is set", () => {
  const line = goalPaceLine({
    metric: "weight",
    startValue: 280,
    targetValue: 178,
    unit: "lb",
    targetDate: null,
  });
  assert.ok(line);
  assert.match(line, /Settle a date with the client/);
});
