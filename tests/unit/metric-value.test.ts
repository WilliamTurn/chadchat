// RC-8: the shared MetricValue mechanism. These pin the invariants that make a
// scopeless number unrepresentable: the value always formats through the ONE
// canonical formatter, a declared scope always renders, and the chart-context
// escape is deliberate (opt-in), not a silent hole. Run with: pnpm test:unit
//
// The component's render logic is pure and exported (metricValueText /
// metricScopeText) so it is testable in this repo's node:test style; the
// type-level requirement (a scopeless call site does not compile) is asserted
// with @ts-expect-error below and enforced by `tsc --noEmit`, which typechecks
// this file (tsconfig includes **/*.ts).

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MetricValue,
  type MetricScope,
  metricScopeText,
  metricValueText,
} from "../../components/dashboard/metric-value";
import { formatQuantity, type UnitId } from "../../lib/contracts/units";

test("value always formats through the canonical formatter", () => {
  const cases: Array<[number, UnitId]> = [
    [6, "count"],
    [6880, "lb"],
    [2300, "kcal"],
    [64, "oz"],
    [89, "percent"],
    [450, "duration"],
  ];
  for (const [value, unit] of cases) {
    // The mechanism must not hand-roll formatting: its output IS the canonical
    // formatter's output, byte for byte.
    assert.equal(metricValueText(value, unit), formatQuantity(value, unit));
  }
  // Spot-check the member-visible strings so a formatter regression is loud.
  assert.equal(metricValueText(6880, "lb"), "6,880 lb");
  assert.equal(metricValueText(6, "count"), "6");
});

test("a declared scope always renders beside the number", () => {
  const scopes: MetricScope[] = [
    "all time",
    "today",
    "this week",
    "last 30 days",
    "last 12 weeks",
  ];
  for (const scope of scopes) {
    assert.equal(metricScopeText({ scope }), scope);
  }
});

test("the chart-context escape is deliberate: it suppresses the scope text, nothing else", () => {
  // scopeInChart means the enclosing chart's range control states the span, so
  // MetricValue renders no scope phrase of its own. This is opt-in.
  assert.equal(metricScopeText({ scopeInChart: true }), null);
});

test("MetricValue is a component the mechanism exposes", () => {
  // Guards the export surface the sweeps import; a rename breaks this loudly.
  assert.equal(typeof MetricValue, "function");
});

test("type gate: scope or scopeInChart is required (compile-time)", () => {
  // Each of these is a well-formed call.
  const withScope = { value: 6, unit: "count" as UnitId, label: "x", scope: "all time" as MetricScope };
  const withChart = { value: 6, unit: "count" as UnitId, label: "x", scopeInChart: true as const };
  assert.equal(metricScopeText(withScope), "all time");
  assert.equal(metricScopeText(withChart), null);

  // @ts-expect-error — neither scope nor scopeInChart: a scopeless number does
  // not compile. If this ever stops erroring, tsc fails HERE and the recurrence
  // gate is broken.
  const _scopeless: ReturnType<typeof metricScopeText> = metricScopeText({});
  void _scopeless;
});
