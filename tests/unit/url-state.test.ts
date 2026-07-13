/**
 * URL-state grammar tests (FIX-03 / P34-B). The invariants every wired route
 * relies on: invalid params fail safe to defaults, defaults are omitted from
 * the URL (canonical form), tokens stay human-readable, and custom windows
 * round-trip through the DSH-52 ms convention.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyParams,
  customWindowToIso,
  enumParam,
  idParam,
  isIsoDay,
  parseCustomWindow,
  parseRangeToken,
  textParam,
} from "../../lib/url-state";

describe("enumParam", () => {
  const metric = enumParam(
    ["calories", "protein", "carbs", "fat"] as const,
    "calories"
  );

  it("parses a valid token", () => {
    assert.equal(metric.parse("protein"), "protein");
  });

  it("fails safe to the default on garbage, absent, and unknown values", () => {
    assert.equal(metric.parse("banana"), "calories");
    assert.equal(metric.parse(null), "calories");
    assert.equal(metric.parse("%%%"), "calories");
  });

  it("omits the default from the URL and serializes the rest", () => {
    assert.equal(metric.serialize("calories"), null);
    assert.equal(metric.serialize("fat"), "fat");
  });
});

describe("textParam", () => {
  const q = textParam();

  it("round-trips text and omits empty/whitespace", () => {
    assert.equal(q.parse("bench"), "bench");
    assert.equal(q.parse(null), "");
    assert.equal(q.serialize("bench"), "bench");
    assert.equal(q.serialize(""), null);
    assert.equal(q.serialize("   "), null);
  });
});

describe("idParam", () => {
  const report = idParam();

  it("null means closed/none and is omitted", () => {
    assert.equal(report.parse(null), null);
    assert.equal(report.parse(""), null);
    assert.equal(report.parse("abc-123"), "abc-123");
    assert.equal(report.serialize(null), null);
    assert.equal(report.serialize("abc-123"), "abc-123");
  });
});

describe("isIsoDay", () => {
  it("accepts real calendar days only", () => {
    assert.equal(isIsoDay("2026-07-13"), true);
    assert.equal(isIsoDay("2026-02-31"), false); // not a real day
    assert.equal(isIsoDay("2026-7-3"), false); // not zero-padded
    assert.equal(isIsoDay("1710000000"), false); // no epochs in UI URLs
    assert.equal(isIsoDay(null), false);
    assert.equal(isIsoDay("banana"), false);
  });
});

describe("parseRangeToken", () => {
  it("accepts exactly the app's member-facing range tokens", () => {
    for (const token of ["1w", "1m", "3m", "6m", "1y", "all"]) {
      assert.equal(parseRangeToken(token), token);
    }
  });

  it("rejects everything else, including custom (which needs from/to)", () => {
    assert.equal(parseRangeToken("custom"), null);
    assert.equal(parseRangeToken("30d"), null);
    assert.equal(parseRangeToken(null), null);
    assert.equal(parseRangeToken("banana"), null);
  });
});

describe("parseCustomWindow / customWindowToIso", () => {
  it("parses to the DSH-52 picker convention (00:00:00Z .. 23:59:59Z)", () => {
    const w = parseCustomWindow("2026-06-01", "2026-06-30");
    assert.ok(w);
    assert.equal(w.from, Date.parse("2026-06-01T00:00:00Z"));
    assert.equal(w.to, Date.parse("2026-06-30T23:59:59Z"));
  });

  it("reorders swapped bounds like the picker does", () => {
    const w = parseCustomWindow("2026-06-30", "2026-06-01");
    assert.ok(w);
    assert.equal(w.from, Date.parse("2026-06-01T00:00:00Z"));
    assert.equal(w.to, Date.parse("2026-06-30T23:59:59Z"));
  });

  it("fails safe on any invalid half", () => {
    assert.equal(parseCustomWindow("2026-06-01", null), null);
    assert.equal(parseCustomWindow(null, "2026-06-30"), null);
    assert.equal(parseCustomWindow("2026-06-01", "banana"), null);
    assert.equal(parseCustomWindow("2026-02-31", "2026-06-30"), null);
  });

  it("round-trips to canonical ISO days", () => {
    const w = parseCustomWindow("2026-06-01", "2026-06-30");
    assert.ok(w);
    assert.deepEqual(customWindowToIso(w), {
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });
});

describe("applyParams", () => {
  it("sets, deletes (null = default omission), and preserves other params", () => {
    const sp = new URLSearchParams("day=2026-07-01&muscle=chest&utm=x");
    applyParams(sp, { muscle: null, range: "3m" });
    assert.equal(sp.get("muscle"), null);
    assert.equal(sp.get("range"), "3m");
    assert.equal(sp.get("day"), "2026-07-01"); // untouched
    assert.equal(sp.get("utm"), "x"); // unknown params preserved
  });
});
