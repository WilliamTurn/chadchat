// FIX-32 (P56-A): invariants of the Progress overview's windowed summaries
// (lib/progress/overview.ts), the source module for the batch-registered
// window metrics. Pins the honesty rules: unlogged days are never zeros or
// misses, averages divide by logged days only (LC-9), each day grades
// against ITS OWN day's target (FIX-07), and the calorie tolerance band is
// symmetric.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CALORIE_TOLERANCE,
  consistencyWindow,
  hydrationWindow,
  nutritionAdherenceWindow,
  sleepWindow,
  summarizeWindow,
  windowDayAnchorsMs,
} from "../../lib/progress/overview";

const DAY = 86_400_000;
const END = Date.UTC(2026, 6, 8);

function anchors(days: number): number[] {
  return windowDayAnchorsMs(END, days);
}

test("windowDayAnchorsMs spans exactly the window, oldest first", () => {
  const a = anchors(7);
  assert.equal(a.length, 7);
  assert.equal(a[6], END);
  assert.equal(a[0], END - 6 * DAY);
});

test("unlogged days are never graded, counted, or averaged (missing is not zero)", () => {
  const a = anchors(7);
  const s = summarizeWindow({
    dayAnchorsMs: a,
    valueByDay: new Map([[a[6], 100]]),
    targetByDay: new Map(a.map((t) => [t, 100])),
    hit: (v, t) => v >= t,
  });
  assert.equal(s.loggedDays, 1);
  assert.equal(s.gradableDays, 1);
  assert.equal(s.daysAtTarget, 1);
  // Average over LOGGED days only (LC-9): 100, never 100/7.
  assert.equal(s.average, 100);
  assert.equal(s.days.filter((d) => d.status === "unlogged").length, 6);
  assert.equal(s.days.filter((d) => d.status === "missed").length, 0);
});

test("a day with no target that day is logged-but-not-gradable, never missed (FIX-07)", () => {
  const a = anchors(3);
  const s = summarizeWindow({
    dayAnchorsMs: a,
    valueByDay: new Map([
      [a[0], 50],
      [a[2], 50],
    ]),
    // A target exists only on the last day.
    targetByDay: new Map([
      [a[0], null],
      [a[1], null],
      [a[2], 40],
    ]),
    hit: (v, t) => v >= t,
  });
  assert.equal(s.loggedDays, 2);
  assert.equal(s.gradableDays, 1);
  assert.equal(s.daysAtTarget, 1);
  assert.equal(s.days[0].status, "logged");
  assert.equal(s.days[2].status, "hit");
});

test("each day grades against its own day's target, not the current pointer (FIX-07)", () => {
  const a = anchors(2);
  const s = hydrationWindow({
    dayAnchorsMs: a,
    mlByDay: new Map([
      [a[0], 2000],
      [a[1], 2000],
    ]),
    // The goal was raised between the two days: 2000 hits day 1, misses day 2.
    goalMlByDay: new Map([
      [a[0], 2000],
      [a[1], 3000],
    ]),
  });
  assert.equal(s.daysAtTarget, 1);
  assert.equal(s.days[0].status, "hit");
  assert.equal(s.days[1].status, "missed");
});

test("the calorie tolerance band is symmetric around the day's target", () => {
  const a = anchors(3);
  const target = 2000;
  const inside = target * (1 + CALORIE_TOLERANCE);
  const outside = target * (1 + CALORIE_TOLERANCE) + 1;
  const s = nutritionAdherenceWindow({
    dayAnchorsMs: a,
    caloriesByDay: new Map([
      [a[0], target * (1 - CALORIE_TOLERANCE)],
      [a[1], inside],
      [a[2], outside],
    ]),
    targetByDay: new Map(a.map((t) => [t, target])),
  });
  assert.equal(s.daysAtTarget, 2);
  assert.equal(s.days[2].status, "missed");
});

test("sleep nights at goal require meeting that night's goal", () => {
  const a = anchors(2);
  const s = sleepWindow({
    dayAnchorsMs: a,
    minutesByDay: new Map([
      [a[0], 480],
      [a[1], 420],
    ]),
    goalMinutesByDay: new Map(a.map((t) => [t, 480])),
  });
  assert.equal(s.daysAtTarget, 1);
  assert.equal(Math.round(s.average ?? 0), 450);
});

test("consistency counts distinct days with any domain, and per-day intensity", () => {
  const a = anchors(3);
  const cw = consistencyWindow({
    dayAnchorsMs: a,
    domainDays: [
      new Set([a[0], a[2]]), // nutrition
      new Set([a[2]]), // training
      new Set<number>(), // hydration
    ],
  });
  assert.equal(cw.windowDays, 3);
  assert.equal(cw.loggedDays, 2);
  assert.deepEqual(
    cw.days.map((d) => d.domains),
    [1, 0, 2]
  );
});

test("coverage reflects the window and the logged span", () => {
  const a = anchors(7);
  const s = summarizeWindow({
    dayAnchorsMs: a,
    valueByDay: new Map([
      [a[1], 10],
      [a[5], 10],
    ]),
    targetByDay: new Map(),
    hit: () => true,
  });
  assert.deepEqual(s.coverage, {
    loggedDays: 2,
    windowDays: 7,
    points: 2,
    spanDays: 4,
  });
});
