// FEAT-8 per-user day math. Run with: pnpm test:unit
//
// The app's day questions ("is this log part of MY today?", "which day does
// this row bucket into?") are answered on the wall clock of the user's stored
// IANA zone. These tests pin the conversions with fixed UTC instants whose
// local readings are known — the class of bug this ships to kill is "logged at
// 8pm in Chicago, counted toward tomorrow".

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarDayAnchorInTz,
  calendarRangeWindowInTz,
  parseCalendarDay,
  resolveTimezone,
  startOfDayInTz,
  toCalendarDayISO,
} from "../../lib/date";

// 2026-07-02T01:30:00Z = 8:30 PM on July 1 in Chicago (CDT, UTC-5).
const LATE_EVENING_CHICAGO = new Date("2026-07-02T01:30:00Z");

test("calendarDayAnchorInTz keeps a late-night log on the user's own day", () => {
  // The UTC date has already rolled to July 2 — the member's day hasn't.
  assert.equal(
    toCalendarDayISO(calendarDayAnchorInTz(LATE_EVENING_CHICAGO, "America/Chicago")),
    "2026-07-01"
  );
  // For a UTC viewer the same instant IS July 2.
  assert.equal(
    toCalendarDayISO(calendarDayAnchorInTz(LATE_EVENING_CHICAGO, "UTC")),
    "2026-07-02"
  );
  // Tokyo (UTC+9) is already well into July 2.
  assert.equal(
    toCalendarDayISO(calendarDayAnchorInTz(LATE_EVENING_CHICAGO, "Asia/Tokyo")),
    "2026-07-02"
  );
});

test("noon-UTC-anchored calendar days keep meaning the picked day", () => {
  // Stored picked days are anchored at 12:00 UTC (lib/date.ts convention);
  // re-bucketing them by the user's local day must not move them.
  const picked = parseCalendarDay("2026-07-01") as Date;
  for (const tz of [
    "America/Los_Angeles",
    "America/New_York",
    "UTC",
    "Europe/Berlin",
    "Asia/Tokyo",
  ]) {
    assert.equal(
      toCalendarDayISO(calendarDayAnchorInTz(picked, tz)),
      "2026-07-01",
      tz
    );
  }
});

test("startOfDayInTz is the user's real local midnight as a UTC instant", () => {
  // July 1 midnight in Chicago (CDT, UTC-5) = 05:00 UTC.
  assert.equal(
    startOfDayInTz(LATE_EVENING_CHICAGO, "America/Chicago").toISOString(),
    "2026-07-01T05:00:00.000Z"
  );
  // Same instant for a Tokyo member: their local day is July 2, which began
  // at July 1 15:00 UTC.
  assert.equal(
    startOfDayInTz(LATE_EVENING_CHICAGO, "Asia/Tokyo").toISOString(),
    "2026-07-01T15:00:00.000Z"
  );
});

test("startOfDayInTz handles DST transitions (EST vs EDT)", () => {
  // Jan 15 (EST, UTC-5): local midnight = 05:00 UTC.
  assert.equal(
    startOfDayInTz(new Date("2026-01-15T12:00:00Z"), "America/New_York")
      .toISOString(),
    "2026-01-15T05:00:00.000Z"
  );
  // Jul 15 (EDT, UTC-4): local midnight = 04:00 UTC.
  assert.equal(
    startOfDayInTz(new Date("2026-07-15T12:00:00Z"), "America/New_York")
      .toISOString(),
    "2026-07-15T04:00:00.000Z"
  );
});

test("a 'today' window catches both stored-day rows and logged-now rows", () => {
  // A Chicago member's July 1: [Jul 1 05:00 UTC, Jul 2 05:00 UTC).
  const window = calendarRangeWindowInTz("2026-07-01", null, "America/Chicago");
  assert.equal(window.start.toISOString(), "2026-07-01T05:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-07-02T05:00:00.000Z");
  // The noon-UTC anchor of the picked day is inside…
  const anchored = (parseCalendarDay("2026-07-01") as Date).getTime();
  assert.ok(anchored >= window.start.getTime() && anchored < window.end.getTime());
  // …and so is the 8:30pm water log whose UTC date already rolled over.
  const instant = LATE_EVENING_CHICAGO.getTime();
  assert.ok(instant >= window.start.getTime() && instant < window.end.getTime());
});

test("calendarRangeWindowInTz spans multi-day ranges and collapses inverted ones", () => {
  const range = calendarRangeWindowInTz(
    "2026-07-01",
    "2026-07-03",
    "America/New_York"
  );
  assert.equal(range.start.toISOString(), "2026-07-01T04:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-04T04:00:00.000Z");
  const inverted = calendarRangeWindowInTz(
    "2026-07-03",
    "2026-07-01",
    "America/New_York"
  );
  assert.equal(inverted.start.toISOString(), "2026-07-03T04:00:00.000Z");
  assert.equal(inverted.end.toISOString(), "2026-07-04T04:00:00.000Z");
});

test("missing/garbage zones fall back to US Eastern instead of crashing", () => {
  assert.equal(resolveTimezone(null), "America/New_York");
  assert.equal(resolveTimezone("Not/AZone"), "America/New_York");
  assert.equal(resolveTimezone("America/Chicago"), "America/Chicago");
  // 8:30 PM July 1 in Chicago is 9:30 PM in New York — still July 1.
  assert.equal(
    toCalendarDayISO(calendarDayAnchorInTz(LATE_EVENING_CHICAGO, null)),
    "2026-07-01"
  );
});
