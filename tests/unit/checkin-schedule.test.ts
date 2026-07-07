// FEAT-8 + FEAT-15 check-in slot math. Run with: pnpm test:unit
//
// The check-in cron runs HOURLY; each pass derives every member's slot from
// their OWN local day + hour against their OWN /account schedule (chosen days
// for the non-daily frequencies, chosen morning/evening start hours, each with
// a 3-hour delivery window). These tests pin the defaults, the per-zone
// derivation, the day gating, and the sanitizers with fixed UTC instants.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type CheckInSchedulePrefs,
  DEFAULT_CHECK_IN_DAYS,
  DEFAULT_EVENING_HOUR,
  DEFAULT_MORNING_HOUR,
  dueCheckInSlot,
  sanitizeCheckInDays,
  WINDOW_HOURS,
} from "../../lib/checkins/schedule";

// 2026-07-01 is a WEDNESDAY (day 3) in every US zone used below.
function prefs(over: Partial<CheckInSchedulePrefs> = {}): CheckInSchedulePrefs {
  return {
    checkInFrequency: "daily",
    checkInDays: DEFAULT_CHECK_IN_DAYS,
    checkInMorningHour: DEFAULT_MORNING_HOUR,
    checkInEveningHour: DEFAULT_EVENING_HOUR,
    timezone: "America/New_York",
    ...over,
  };
}

test("morning brief fires in the member's own default 7-10am window", () => {
  // 2026-07-01T12:00:00Z = 8am in New York (EDT, UTC-4) → morning.
  const eightAmET = new Date("2026-07-01T12:00:00Z");
  assert.equal(dueCheckInSlot(eightAmET, prefs()), "morning");
  // Same instant is 7am in Chicago → morning there too…
  assert.equal(
    dueCheckInSlot(eightAmET, prefs({ timezone: "America/Chicago" })),
    "morning"
  );
  // …but only 5am in Los Angeles → nothing yet.
  assert.equal(
    dueCheckInSlot(eightAmET, prefs({ timezone: "America/Los_Angeles" })),
    null
  );
  // And 9pm in Tokyo → their EVENING callout.
  assert.equal(
    dueCheckInSlot(eightAmET, prefs({ timezone: "Asia/Tokyo" })),
    "evening"
  );
});

test("evening callout fires in the member's own default 8-11pm window", () => {
  // 2026-07-02T01:00:00Z = 9pm July 1 in New York → evening.
  const ninePmET = new Date("2026-07-02T01:00:00Z");
  assert.equal(dueCheckInSlot(ninePmET, prefs()), "evening");
  // Same instant is 6pm in Los Angeles → not yet.
  assert.equal(
    dueCheckInSlot(ninePmET, prefs({ timezone: "America/Los_Angeles" })),
    null
  );
});

test("nothing fires outside both windows", () => {
  // 2026-07-01T18:00:00Z = 2pm in New York, mid-afternoon → no slot.
  assert.equal(
    dueCheckInSlot(new Date("2026-07-01T18:00:00Z"), prefs()),
    null
  );
  // 07:00Z = 3am in New York, dead of night → no slot.
  assert.equal(
    dueCheckInSlot(new Date("2026-07-01T07:00:00Z"), prefs()),
    null
  );
});

test("member-chosen hours move the windows ([start, start+3), half-open)", () => {
  const nineAmET = new Date("2026-07-01T13:00:00Z");
  // Default 7am start → 9am is in; with a 10am start → not yet.
  assert.equal(dueCheckInSlot(nineAmET, prefs()), "morning");
  assert.equal(
    dueCheckInSlot(nineAmET, prefs({ checkInMorningHour: 10 })),
    null
  );
  assert.equal(WINDOW_HOURS, 3);
  // Exactly the chosen hour → in; exactly chosen+3 → out.
  const elevenAmET = new Date("2026-07-01T15:00:00Z");
  assert.equal(
    dueCheckInSlot(elevenAmET, prefs({ checkInMorningHour: 11 })),
    "morning"
  );
  const tenAmET = new Date("2026-07-01T14:00:00Z");
  assert.equal(
    dueCheckInSlot(tenAmET, prefs({ checkInMorningHour: 7 })),
    null
  );
  // Evening: 6pm ET with a 5pm start → in; with the default 8pm start → out.
  const sixPmET = new Date("2026-07-01T22:00:00Z");
  assert.equal(
    dueCheckInSlot(sixPmET, prefs({ checkInEveningHour: 17 })),
    "evening"
  );
  assert.equal(dueCheckInSlot(sixPmET, prefs()), null);
});

test("non-daily frequencies only fire on the member's chosen days", () => {
  const eightAmWedET = new Date("2026-07-01T12:00:00Z"); // Wednesday (3)
  // Wednesday picked → fires.
  assert.equal(
    dueCheckInSlot(
      eightAmWedET,
      prefs({ checkInFrequency: "three_per_week", checkInDays: [1, 3, 5] })
    ),
    "morning"
  );
  // Wednesday not picked → skipped, even in the window.
  assert.equal(
    dueCheckInSlot(
      eightAmWedET,
      prefs({ checkInFrequency: "three_per_week", checkInDays: [1, 2, 5] })
    ),
    null
  );
  assert.equal(
    dueCheckInSlot(
      eightAmWedET,
      prefs({ checkInFrequency: "weekly", checkInDays: [1] })
    ),
    null
  );
  assert.equal(
    dueCheckInSlot(
      eightAmWedET,
      prefs({ checkInFrequency: "weekly", checkInDays: [3] })
    ),
    "morning"
  );
  // "daily" ignores the day picks entirely.
  assert.equal(
    dueCheckInSlot(
      eightAmWedET,
      prefs({ checkInFrequency: "daily", checkInDays: [1] })
    ),
    "morning"
  );
});

test("danger window escalates cadence: chosen-days gate ignored, hours kept", () => {
  const eightAmWedET = new Date("2026-07-01T12:00:00Z"); // Wednesday (3)
  // Wednesday NOT picked → normally skipped, but the danger window fires it.
  const notWednesday = prefs({
    checkInFrequency: "three_per_week",
    checkInDays: [1, 2, 5],
  });
  assert.equal(dueCheckInSlot(eightAmWedET, notWednesday), null);
  assert.equal(
    dueCheckInSlot(eightAmWedET, notWednesday, { dangerWindow: true }),
    "morning"
  );
  assert.equal(
    dueCheckInSlot(
      eightAmWedET,
      prefs({ checkInFrequency: "weekly", checkInDays: [1] }),
      { dangerWindow: true }
    ),
    "morning"
  );
  // The hour windows still hold: 2pm ET stays silent even in the window.
  assert.equal(
    dueCheckInSlot(new Date("2026-07-01T18:00:00Z"), notWednesday, {
      dangerWindow: true,
    }),
    null
  );
});

test("garbage stored values fall back to safe defaults", () => {
  const eightAmET = new Date("2026-07-01T12:00:00Z");
  // Missing/garbage zones fall back to US Eastern.
  assert.equal(dueCheckInSlot(eightAmET, prefs({ timezone: null })), "morning");
  assert.equal(
    dueCheckInSlot(eightAmET, prefs({ timezone: "Not/AZone" })),
    "morning"
  );
  // Out-of-range hours fall back to 7am/8pm.
  assert.equal(
    dueCheckInSlot(eightAmET, prefs({ checkInMorningHour: 99 })),
    "morning"
  );
  // Garbage day lists fall back to Mon/Wed/Fri (Wednesday → fires).
  assert.equal(
    dueCheckInSlot(
      eightAmET,
      prefs({
        checkInFrequency: "three_per_week",
        checkInDays: "nope" as unknown as number[],
      })
    ),
    "morning"
  );
  assert.deepEqual(sanitizeCheckInDays([9, 2, 2, -1, 5]), [2, 5]);
  assert.deepEqual(sanitizeCheckInDays([]), DEFAULT_CHECK_IN_DAYS);
  assert.deepEqual(sanitizeCheckInDays(undefined), DEFAULT_CHECK_IN_DAYS);
});
