// FEAT-8 check-in slot math. Run with: pnpm test:unit
//
// The check-in cron runs HOURLY; each pass derives every member's slot from
// their OWN local hour — morning brief in the ~7-10am window, evening callout
// in the ~8-11pm window, nothing in between. These tests pin the windows and
// the per-zone derivation with fixed UTC instants.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dueCheckInSlot,
  EVENING_WINDOW,
  MORNING_WINDOW,
} from "../../lib/checkins/schedule";

test("morning brief fires in the member's own 7-10am window", () => {
  // 2026-07-01T12:00:00Z = 8am in New York (EDT, UTC-4) → morning.
  const eightAmET = new Date("2026-07-01T12:00:00Z");
  assert.equal(dueCheckInSlot(eightAmET, "America/New_York"), "morning");
  // Same instant is 7am in Chicago → morning there too…
  assert.equal(dueCheckInSlot(eightAmET, "America/Chicago"), "morning");
  // …but only 5am in Los Angeles → nothing yet.
  assert.equal(dueCheckInSlot(eightAmET, "America/Los_Angeles"), null);
  // And 9pm in Tokyo → their EVENING callout.
  assert.equal(dueCheckInSlot(eightAmET, "Asia/Tokyo"), "evening");
});

test("evening callout fires in the member's own 8-11pm window", () => {
  // 2026-07-02T01:00:00Z = 9pm July 1 in New York → evening.
  const ninePmET = new Date("2026-07-02T01:00:00Z");
  assert.equal(dueCheckInSlot(ninePmET, "America/New_York"), "evening");
  // Same instant is 6pm in Los Angeles → not yet.
  assert.equal(dueCheckInSlot(ninePmET, "America/Los_Angeles"), null);
});

test("nothing fires outside both windows", () => {
  // 2026-07-01T18:00:00Z = 2pm in New York — mid-afternoon, no slot.
  assert.equal(
    dueCheckInSlot(new Date("2026-07-01T18:00:00Z"), "America/New_York"),
    null
  );
  // 07:00Z = 3am in New York — dead of night, no slot.
  assert.equal(
    dueCheckInSlot(new Date("2026-07-01T07:00:00Z"), "America/New_York"),
    null
  );
});

test("window bounds are half-open ([start, end))", () => {
  // Pin the windows themselves — the hourly cron's cost ceiling depends on them.
  assert.deepEqual(MORNING_WINDOW, { start: 7, end: 10 });
  assert.deepEqual(EVENING_WINDOW, { start: 20, end: 23 });
  // Exactly 7am ET (11:00Z in July) → in; exactly 10am ET (14:00Z) → out.
  assert.equal(
    dueCheckInSlot(new Date("2026-07-01T11:00:00Z"), "America/New_York"),
    "morning"
  );
  assert.equal(
    dueCheckInSlot(new Date("2026-07-01T14:00:00Z"), "America/New_York"),
    null
  );
  // Exactly 11pm ET (03:00Z next UTC day) → out.
  assert.equal(
    dueCheckInSlot(new Date("2026-07-02T03:00:00Z"), "America/New_York"),
    null
  );
});

test("missing/garbage zones fall back to US Eastern", () => {
  const eightAmET = new Date("2026-07-01T12:00:00Z");
  assert.equal(dueCheckInSlot(eightAmET, null), "morning");
  assert.equal(dueCheckInSlot(eightAmET, "Not/AZone"), "morning");
});
