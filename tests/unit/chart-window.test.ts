/**
 * Window-axis math tests (FIX-18 / DSH-60). The invariants every shared chart
 * relies on: axes derive from the WINDOW, day slots never turn missing into
 * zero, and week bins count truthful zeros.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MS_PER_DAY } from "../../lib/chart/trend";
import {
  clampToWindow,
  toDaySlots,
  toWeekSlots,
  windowDayAnchors,
  windowEndingAt,
  windowFromExtent,
  windowTicks,
} from "../../lib/chart/window";

const TODAY = Date.UTC(2026, 6, 8); // the fixture anchor day

describe("windowEndingAt", () => {
  it("spans exactly the requested days, inclusive of today", () => {
    const w = windowEndingAt(TODAY, 7);
    assert.equal(w.days, 7);
    assert.equal(w.endMs, TODAY);
    assert.equal(w.startMs, TODAY - 6 * MS_PER_DAY);
    assert.equal(windowDayAnchors(w).length, 7);
  });

  it("never collapses below one day", () => {
    const w = windowEndingAt(TODAY, 0);
    assert.equal(w.days, 1);
    assert.equal(w.startMs, w.endMs);
  });
});

describe("windowFromExtent", () => {
  it("spans first logged day through today, not the data extent", () => {
    const rows = [{ t: TODAY - 9 * MS_PER_DAY }, { t: TODAY - 2 * MS_PER_DAY }];
    const w = windowFromExtent(rows, TODAY);
    assert.equal(w.startMs, TODAY - 9 * MS_PER_DAY);
    assert.equal(w.endMs, TODAY); // NOT the last logged day
    assert.equal(w.days, 10);
  });

  it("keeps a minimum span for near-empty data", () => {
    assert.equal(windowFromExtent([], TODAY).days, 7);
    assert.equal(windowFromExtent([{ t: TODAY }], TODAY).days, 7);
  });
});

describe("windowTicks (DSH-60: ticks span the window)", () => {
  it("first and last ticks are the window edges", () => {
    const w = windowEndingAt(TODAY, 30);
    const ticks = windowTicks(w, 6);
    assert.equal(ticks[0], w.startMs);
    assert.equal(ticks[ticks.length - 1], w.endMs);
    assert.ok(ticks.length <= 7);
  });

  it("every tick is a whole-day anchor inside the window", () => {
    const w = windowEndingAt(TODAY, 90);
    for (const t of windowTicks(w, 6)) {
      assert.ok(t >= w.startMs && t <= w.endMs);
      assert.equal((t - w.startMs) % MS_PER_DAY, 0);
    }
  });

  it("a 7-day window ticks every day when asked", () => {
    const w = windowEndingAt(TODAY, 7);
    assert.equal(windowTicks(w, 7).length, 7);
  });
});

describe("clampToWindow", () => {
  it("keeps points at their true dates inside the window only", () => {
    const w = windowEndingAt(TODAY, 7);
    const rows = [
      { t: TODAY - 10 * MS_PER_DAY },
      { t: TODAY - 3 * MS_PER_DAY },
      { t: TODAY },
    ];
    const kept = clampToWindow(rows, w);
    assert.equal(kept.length, 2);
    assert.equal(kept[0].t, TODAY - 3 * MS_PER_DAY);
  });
});

describe("toDaySlots (missing is never zero)", () => {
  it("emits one slot per window day with null for unlogged days", () => {
    const w = windowEndingAt(TODAY, 7);
    const slots = toDaySlots(w, [
      { t: TODAY - 6 * MS_PER_DAY, value: 100 },
      { t: TODAY, value: 40 },
    ]);
    assert.equal(slots.length, 7);
    assert.equal(slots[0].value, 100);
    assert.equal(slots[6].value, 40);
    for (const s of slots.slice(1, 6)) {
      assert.equal(s.value, null); // never 0
    }
  });

  it("sums multiple logs on the same day", () => {
    const w = windowEndingAt(TODAY, 3);
    const slots = toDaySlots(w, [
      { t: TODAY, value: 10 },
      { t: TODAY + 6 * 60 * 60 * 1000, value: 5 }, // an instant later that day
    ]);
    assert.equal(slots[2].value, 15);
  });

  it("drops rows outside the window", () => {
    const w = windowEndingAt(TODAY, 3);
    const slots = toDaySlots(w, [{ t: TODAY - 30 * MS_PER_DAY, value: 99 }]);
    assert.ok(slots.every((s) => s.value == null));
  });
});

describe("toWeekSlots (counts render truthful zeros)", () => {
  it("bins events into trailing 7-day windows ending today", () => {
    const w = windowEndingAt(TODAY, 28);
    const slots = toWeekSlots(w, [
      { t: TODAY }, // this week
      { t: TODAY - 2 * MS_PER_DAY }, // this week
      { t: TODAY - 20 * MS_PER_DAY }, // three weeks back
    ]);
    assert.equal(slots.length, 4);
    assert.equal(slots[3].value, 2);
    assert.equal(slots[1].value, 1);
    assert.equal(slots[0].value, 0); // a zero COUNT, not "missing"
    assert.equal(slots[2].value, 0);
  });
});
