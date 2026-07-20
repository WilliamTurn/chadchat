/**
 * Up-next selector tests (FIX-28, consumed by P6 FIX-23). The verdict must
 * be deterministic, inspectable, and safe when data is missing.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weeklyPlanAdherence } from "../../lib/plans/adherence";
import type { PlanSchedule } from "../../lib/plans/schedule";
import { selectUpNextSession } from "../../lib/plans/up-next";

const DAY = 24 * 60 * 60 * 1000;

function schedule(ids: (string | null)[]): PlanSchedule {
  return {
    planId: "plan-1",
    sessions: ids.map((id, position) => ({
      id,
      position,
      name: `Day ${position + 1}`,
      weekday: null,
      exercises: [],
    })),
  };
}

describe("selectUpNextSession", () => {
  it("returns null for an empty schedule", () => {
    assert.equal(selectUpNextSession(schedule([]), []), null);
  });

  it("picks the first session when nothing is completed", () => {
    const verdict = selectUpNextSession(schedule(["a", "b", "c"]), []);
    assert.equal(verdict?.session.position, 0);
    assert.equal(verdict?.reason, "The first workout of your rotation.");
  });

  it("advances the rotation after a completion", () => {
    const verdict = selectUpNextSession(schedule(["a", "b", "c"]), [
      { planSessionId: "a", completedDayMs: 10 * DAY },
    ]);
    assert.equal(verdict?.session.position, 1);
  });

  it("returns to a skipped session before repeating a done one", () => {
    const verdict = selectUpNextSession(schedule(["a", "b", "c"]), [
      { planSessionId: "a", completedDayMs: 10 * DAY },
      { planSessionId: "c", completedDayMs: 12 * DAY },
    ]);
    assert.equal(verdict?.session.position, 1);
  });

  it("wraps to the least-recently-done session after a full cycle", () => {
    const verdict = selectUpNextSession(schedule(["a", "b", "c"]), [
      { planSessionId: "a", completedDayMs: 10 * DAY },
      { planSessionId: "b", completedDayMs: 11 * DAY },
      { planSessionId: "c", completedDayMs: 12 * DAY },
    ]);
    assert.equal(verdict?.session.position, 0);
  });

  it("uses the LATEST completion per session, not the first", () => {
    const verdict = selectUpNextSession(schedule(["a", "b"]), [
      { planSessionId: "a", completedDayMs: 1 * DAY },
      { planSessionId: "b", completedDayMs: 2 * DAY },
      { planSessionId: "a", completedDayMs: 3 * DAY },
    ]);
    assert.equal(verdict?.session.position, 1);
  });

  it("is safe on the legacy view (null ids read as never completed)", () => {
    const verdict = selectUpNextSession(schedule([null, null]), [
      { planSessionId: "ghost", completedDayMs: 5 * DAY },
    ]);
    assert.equal(verdict?.session.position, 0);
  });

  it("is deterministic: identical inputs give the identical verdict", () => {
    const completions = [{ planSessionId: "b", completedDayMs: 4 * DAY }];
    const first = selectUpNextSession(schedule(["a", "b"]), completions);
    const second = selectUpNextSession(schedule(["a", "b"]), completions);
    assert.deepEqual(first, second);
  });
});

describe("weeklyPlanAdherence", () => {
  it("counts only completions inside the member-local week window", () => {
    const result = weeklyPlanAdherence({
      schedule: schedule(["a", "b", "c", "d"]),
      completions: [
        { planSessionId: "a", completedDayMs: 9 * DAY }, // before the week
        { planSessionId: "b", completedDayMs: 10 * DAY },
        { planSessionId: "c", completedDayMs: 16 * DAY },
        { planSessionId: "d", completedDayMs: 17 * DAY }, // after the week
      ],
      weekStartMs: 10 * DAY,
      weekEndMs: 17 * DAY,
    });
    assert.equal(result.plannedPerWeek, 4);
    assert.equal(result.completedThisWeek, 2);
  });

  it("never rewrites a past week: events are immutable inputs", () => {
    // A shrunk rotation changes plannedPerWeek going forward, but the same
    // completion events yield the same completed count for the same window.
    const completions = [{ planSessionId: "a", completedDayMs: 11 * DAY }];
    const before = weeklyPlanAdherence({
      schedule: schedule(["a", "b", "c"]),
      completions,
      weekStartMs: 10 * DAY,
      weekEndMs: 17 * DAY,
    });
    const after = weeklyPlanAdherence({
      schedule: schedule(["a", "b"]),
      completions,
      weekStartMs: 10 * DAY,
      weekEndMs: 17 * DAY,
    });
    assert.equal(before.completedThisWeek, after.completedThisWeek);
  });
});
