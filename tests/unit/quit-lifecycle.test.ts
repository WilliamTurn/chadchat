// FEAT-22 Quit Date lifecycle math. Run with: pnpm test:unit
//
// Pins the day-of-membership counting, the danger-window bounds, the
// beaten/hit outcome rules, and the deterministic reissue heuristic. All
// dates are 00:00-UTC calendar-day anchors (the todayAnchorInTz shape the
// stored quitDate uses).

import assert from "node:assert/strict";
import { test } from "node:test";
import { deRoundDay, reissueQuitDay } from "../../lib/quit/heuristics";
import {
  DANGER_WINDOW_AFTER_DAYS,
  DANGER_WINDOW_BEFORE_DAYS,
  DAY_MS,
  dayNumberOn,
  dayOneAnchor,
  daysUntilQuit,
  HIT_SILENCE_DAYS,
  isInDangerWindow,
  quitOutcome,
} from "../../lib/quit/lifecycle";

function anchor(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function shift(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

// A Day-23 prediction issued 2026-07-01 → quit date 2026-07-23.
const QUIT = anchor("2026-07-23");
const DAY_COUNT = 23;

test("day-of-membership math round-trips the stored shape", () => {
  // Day 1 = the autopsy day: quitDate - (dayCount - 1) days.
  assert.deepEqual(dayOneAnchor(QUIT, DAY_COUNT), anchor("2026-07-01"));
  assert.equal(dayNumberOn(anchor("2026-07-01"), QUIT, DAY_COUNT), 1);
  assert.equal(dayNumberOn(anchor("2026-07-14"), QUIT, DAY_COUNT), 14);
  assert.equal(dayNumberOn(QUIT, QUIT, DAY_COUNT), DAY_COUNT);
  assert.equal(dayNumberOn(shift(QUIT, 5), QUIT, DAY_COUNT), DAY_COUNT + 5);
  assert.equal(daysUntilQuit(anchor("2026-07-14"), QUIT), 9);
  assert.equal(daysUntilQuit(shift(QUIT, 2), QUIT), -2);
});

test("danger window spans quitDate - 5 through quitDate + 2, inclusive", () => {
  assert.equal(DANGER_WINDOW_BEFORE_DAYS, 5);
  assert.equal(DANGER_WINDOW_AFTER_DAYS, 2);
  assert.equal(isInDangerWindow(shift(QUIT, -6), QUIT), false);
  assert.equal(isInDangerWindow(shift(QUIT, -5), QUIT), true);
  assert.equal(isInDangerWindow(QUIT, QUIT), true);
  assert.equal(isInDangerWindow(shift(QUIT, 2), QUIT), true);
  assert.equal(isInDangerWindow(shift(QUIT, 3), QUIT), false);
});

test("outcome stays pending until the member's day passes the date", () => {
  // On the date itself: pending, whatever the activity says.
  assert.equal(
    quitOutcome({
      todayAnchor: QUIT,
      quitDateAnchor: QUIT,
      lastActivityAnchor: QUIT,
    }),
    "pending"
  );
  // Past the date but inside the silence grace with no post-date activity.
  assert.equal(
    quitOutcome({
      todayAnchor: shift(QUIT, HIT_SILENCE_DAYS - 1),
      quitDateAnchor: QUIT,
      lastActivityAnchor: shift(QUIT, -2),
    }),
    "pending"
  );
});

test("logging on a day past the date beats the prediction", () => {
  // Activity ON the quit day is not past it; the day after is.
  assert.equal(
    quitOutcome({
      todayAnchor: shift(QUIT, 1),
      quitDateAnchor: QUIT,
      lastActivityAnchor: shift(QUIT, 1),
    }),
    "beaten"
  );
  // Beaten wins even deep past the grace window (a backfilled log counts).
  assert.equal(
    quitOutcome({
      todayAnchor: shift(QUIT, 10),
      quitDateAnchor: QUIT,
      lastActivityAnchor: shift(QUIT, 4),
    }),
    "beaten"
  );
});

test("silence for the full grace window past the date is a hit", () => {
  assert.equal(HIT_SILENCE_DAYS, 3);
  assert.equal(
    quitOutcome({
      todayAnchor: shift(QUIT, HIT_SILENCE_DAYS),
      quitDateAnchor: QUIT,
      lastActivityAnchor: shift(QUIT, -1),
    }),
    "hit"
  );
  // Never logged anything at all → still a hit once the grace passes.
  assert.equal(
    quitOutcome({
      todayAnchor: shift(QUIT, HIT_SILENCE_DAYS),
      quitDateAnchor: QUIT,
      lastActivityAnchor: null,
    }),
    "hit"
  );
});

test("deRoundDay skips multiples of 5 and 7", () => {
  assert.equal(deRoundDay(23), 23);
  assert.equal(deRoundDay(35), 36); // 35 = 5·7 → 36
  assert.equal(deRoundDay(20), 22); // 20 → 21 (7·3) → 22
  assert.equal(deRoundDay(49), 51); // 49 (7²) → 50 (5·10) → 51
});

test("reissued dates are harder, de-rounded, and always leave runway", () => {
  // Day 23 beaten on day 24: 23 + round(23·0.6)=14 → 37 (not 5/7-divisible).
  assert.equal(reissueQuitDay(23, 24), 37);
  // Small first date: growth floors at 11 days over the old count, and the
  // new date must sit at least 13 days past the day the beat resolved.
  assert.equal(reissueQuitDay(13, 14), 27); // max(13+11, 14+13)=27
  // A slow resolution (member well past the old date) still gets runway.
  assert.equal(reissueQuitDay(23, 40), 53); // max(37, 53)=53, de-rounded ok
  // Determinism + invariants across a sweep.
  for (let prev = 10; prev <= 120; prev++) {
    for (const current of [prev + 1, prev + 3, prev + 20]) {
      const next = reissueQuitDay(prev, current);
      assert.equal(next, reissueQuitDay(prev, current));
      assert.ok(next > prev, `harder than the beaten date (${prev})`);
      assert.ok(next >= current + 13, `runway past day ${current}`);
      assert.notEqual(next % 5, 0);
      assert.notEqual(next % 7, 0);
    }
  }
});
