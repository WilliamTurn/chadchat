/**
 * Effective-dated target resolution tests (FIX-07 / DSH-66 P4). The invariant
 * this file proves at the pure layer: A TARGET CHANGE NEVER REWRITES A PRIOR
 * DAY'S INTERPRETATION. The version active on day D is the latest version
 * effective on or before D; days before a member's first-ever target have no
 * target; a member with zero version rows keeps the pre-FIX-07 behavior
 * (every day resolves to the live current-pointer target).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeVersionValues,
  EPOCH_DAY_MS,
  type EffectiveVersion,
  planTargetWrite,
  resolveTargetByDay,
} from "../../lib/targets/effective";

const DAY = 24 * 60 * 60 * 1000;
// Fixed anchors (00:00-UTC day keys, same shape as calendarDayAnchorInTz).
const JUL_1 = Date.UTC(2026, 6, 1);
const JUL_5 = Date.UTC(2026, 6, 5);
const JUL_8 = Date.UTC(2026, 6, 8);
const JUL_10 = Date.UTC(2026, 6, 10);

type Macro = { calories: number | null };

function v(
  effectiveDayMs: number,
  calories: number,
  createdAtMs = effectiveDayMs
): EffectiveVersion<Macro> {
  return { effectiveDayMs, createdAtMs, values: { calories } };
}

describe("activeVersionValues", () => {
  const versions = [v(JUL_1, 2000), v(JUL_8, 1800)];

  it("resolves the version active on the day, not the latest version", () => {
    assert.deepEqual(activeVersionValues(versions, JUL_5), {
      calories: 2000,
    });
    assert.deepEqual(activeVersionValues(versions, JUL_10), {
      calories: 1800,
    });
  });

  it("a version takes effect ON its effective day", () => {
    assert.deepEqual(activeVersionValues(versions, JUL_8), {
      calories: 1800,
    });
  });

  it("days before the first version have no target", () => {
    assert.equal(activeVersionValues(versions, JUL_1 - DAY), null);
  });

  it("same-day re-edits: the latest createdAt wins", () => {
    const reEdited = [
      v(JUL_1, 2000),
      v(JUL_8, 1800, JUL_8 + 1000),
      v(JUL_8, 1750, JUL_8 + 2000),
    ];
    assert.deepEqual(activeVersionValues(reEdited, JUL_8), {
      calories: 1750,
    });
    assert.deepEqual(activeVersionValues(reEdited, JUL_10), {
      calories: 1750,
    });
  });

  it("is order-independent", () => {
    const shuffled = [v(JUL_8, 1800), v(JUL_1, 2000)];
    assert.deepEqual(activeVersionValues(shuffled, JUL_5), {
      calories: 2000,
    });
  });
});

describe("resolveTargetByDay", () => {
  it("zero versions: every day resolves to the live current pointer (pre-FIX-07 behavior)", () => {
    const resolved = resolveTargetByDay<Macro>([], [JUL_1, JUL_5, JUL_10], {
      calories: 2200,
    });
    assert.deepEqual(resolved, [
      { calories: 2200 },
      { calories: 2200 },
      { calories: 2200 },
    ]);
  });

  it("with versions, the fallback is never consulted", () => {
    const resolved = resolveTargetByDay<Macro>(
      [v(JUL_8, 1800)],
      [JUL_5, JUL_10],
      { calories: 9999 }
    );
    assert.deepEqual(resolved, [null, { calories: 1800 }]);
  });
});

describe("planTargetWrite", () => {
  it("first versioned write with a pre-existing target epoch-seeds the old value", () => {
    const inserts = planTargetWrite<Macro>({
      hasVersions: false,
      previous: { calories: 2000 },
      next: { calories: 1800 },
      todayAnchorMs: JUL_8,
    });
    assert.deepEqual(inserts, [
      { effectiveDayMs: EPOCH_DAY_MS, values: { calories: 2000 } },
      { effectiveDayMs: JUL_8, values: { calories: 1800 } },
    ]);
  });

  it("first-ever target (nothing to seed) becomes effective today only", () => {
    const inserts = planTargetWrite<Macro>({
      hasVersions: false,
      previous: null,
      next: { calories: 1800 },
      todayAnchorMs: JUL_8,
    });
    assert.deepEqual(inserts, [
      { effectiveDayMs: JUL_8, values: { calories: 1800 } },
    ]);
  });

  it("subsequent writes never re-seed", () => {
    const inserts = planTargetWrite<Macro>({
      hasVersions: true,
      previous: { calories: 1800 },
      next: { calories: 1700 },
      todayAnchorMs: JUL_10,
    });
    assert.deepEqual(inserts, [
      { effectiveDayMs: JUL_10, values: { calories: 1700 } },
    ]);
  });
});

describe("FIX-07 invariant: a target change never rewrites a prior day", () => {
  it("end-to-end at the pure layer: seed, change, and re-read history", () => {
    // Member has had a 2000 kcal target since before FIX-07 (current pointer
    // only). On JUL_8 they change it to 1800: the write plan epoch-seeds the
    // old 2000 and adds 1800 effective JUL_8.
    const inserts = planTargetWrite<Macro>({
      hasVersions: false,
      previous: { calories: 2000 },
      next: { calories: 1800 },
      todayAnchorMs: JUL_8,
    });
    const versions = inserts.map((ins, i) => ({
      effectiveDayMs: ins.effectiveDayMs,
      createdAtMs: JUL_8 + i, // insert order
      values: ins.values,
    }));

    // JUL_5 (before the change) still reads the OLD target; JUL_8 onward the
    // new one. The current pointer now holds 1800, and is never consulted.
    const resolved = resolveTargetByDay<Macro>(
      versions,
      [JUL_5, JUL_8, JUL_10],
      { calories: 1800 }
    );
    assert.deepEqual(resolved, [
      { calories: 2000 },
      { calories: 1800 },
      { calories: 1800 },
    ]);
  });

  it("clearing a single-value goal to the default is a dated fact", () => {
    // Water-goal shape: { value: number | null }, null = the default.
    const versions: EffectiveVersion<{ value: number | null }>[] = [
      { effectiveDayMs: EPOCH_DAY_MS, createdAtMs: 0, values: { value: 3000 } },
      { effectiveDayMs: JUL_8, createdAtMs: JUL_8, values: { value: null } },
    ];
    const resolved = resolveTargetByDay(versions, [JUL_5, JUL_10], {
      value: null,
    });
    assert.deepEqual(resolved, [{ value: 3000 }, { value: null }]);
  });
});
