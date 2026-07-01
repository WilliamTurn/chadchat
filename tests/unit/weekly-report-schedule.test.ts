// FEAT-12 schedule math. Run with: pnpm test:unit
//
// The weekly-report cron runs HOURLY and asks, per member, "in YOUR timezone,
// is it your chosen day, at or past your chosen hour?" These tests pin the
// timezone conversion (the part that's easy to get silently wrong) using
// fixed UTC instants whose wall-clock time in each zone is known.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isReportDue,
  isValidTimezone,
  localDayHour,
} from "../../lib/reports/schedule";

// Sunday 2026-07-05 21:00 UTC = Sunday 5:00 PM in New York (EDT, UTC-4).
const SUNDAY_5PM_ET = new Date("2026-07-05T21:00:00Z");

test("localDayHour converts a UTC instant to the zone's wall clock", () => {
  assert.deepEqual(localDayHour(SUNDAY_5PM_ET, "America/New_York"), {
    day: 0,
    hour: 17,
  });
  // Same instant in Chicago is 4pm; in UTC it's 9pm.
  assert.deepEqual(localDayHour(SUNDAY_5PM_ET, "America/Chicago"), {
    day: 0,
    hour: 16,
  });
  assert.deepEqual(localDayHour(SUNDAY_5PM_ET, "UTC"), { day: 0, hour: 21 });
});

test("localDayHour crosses the date line correctly", () => {
  // Sunday 21:00 UTC is already MONDAY 7am in Tokyo (UTC+9) — a Tokyo member's
  // "Sunday 5pm" must NOT fire at this instant.
  assert.deepEqual(localDayHour(SUNDAY_5PM_ET, "Asia/Tokyo"), {
    day: 1,
    hour: 6,
  });
});

test("null/garbage timezones fall back to US Eastern instead of crashing", () => {
  assert.deepEqual(localDayHour(SUNDAY_5PM_ET, null), { day: 0, hour: 17 });
  assert.deepEqual(localDayHour(SUNDAY_5PM_ET, "Not/AZone"), {
    day: 0,
    hour: 17,
  });
  assert.equal(isValidTimezone("America/Chicago"), true);
  assert.equal(isValidTimezone("Not/AZone"), false);
});

test("isReportDue fires on the chosen day at or after the chosen hour", () => {
  const prefs = {
    weeklyReportDay: 0, // Sunday
    weeklyReportHour: 17, // 5pm
    timezone: "America/New_York",
  };
  // Exactly 5pm Sunday ET → due.
  assert.equal(isReportDue(SUNDAY_5PM_ET, prefs), true);
  // 8pm Sunday ET (a delayed/later cron pass the same day) → still due; the
  // once-per-week ledger dedup is what stops a second send.
  assert.equal(
    isReportDue(new Date("2026-07-06T00:00:00Z"), prefs),
    true
  );
  // 4pm Sunday ET → not yet.
  assert.equal(
    isReportDue(new Date("2026-07-05T20:00:00Z"), prefs),
    false
  );
  // Monday ET → wrong day.
  assert.equal(
    isReportDue(new Date("2026-07-06T21:00:00Z"), prefs),
    false
  );
});

test("isReportDue respects the member's own zone, not the server's", () => {
  // Saturday 10am in Los Angeles = Saturday 17:00 UTC.
  const prefs = {
    weeklyReportDay: 6,
    weeklyReportHour: 10,
    timezone: "America/Los_Angeles",
  };
  assert.equal(
    isReportDue(new Date("2026-07-04T17:00:00Z"), prefs),
    true
  );
  // Same wall-clock instant is Sunday 2am in Tokyo — for a Tokyo member with
  // the same prefs it must be false.
  assert.equal(
    isReportDue(new Date("2026-07-04T17:00:00Z"), {
      ...prefs,
      timezone: "Asia/Tokyo",
    }),
    false
  );
});
