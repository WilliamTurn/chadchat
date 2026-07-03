import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRestDuration } from "@/components/workouts/rest-timer";

describe("parseRestDuration", () => {
  it("parses plain seconds", () => {
    assert.equal(parseRestDuration("90"), 90);
    assert.equal(parseRestDuration(" 150 "), 150);
  });

  it("parses m:ss", () => {
    assert.equal(parseRestDuration("2:30"), 150);
    assert.equal(parseRestDuration("0:45"), 45);
    assert.equal(parseRestDuration("10:00"), 600);
  });

  it("rejects junk, zero, and out-of-range values", () => {
    assert.equal(parseRestDuration(""), null);
    assert.equal(parseRestDuration("abc"), null);
    assert.equal(parseRestDuration("0"), null);
    assert.equal(parseRestDuration("-30"), null);
    assert.equal(parseRestDuration("2:75"), null);
    assert.equal(parseRestDuration("1:2:3"), null);
    assert.equal(parseRestDuration("3601"), null);
    assert.equal(parseRestDuration("1.5"), null);
  });
});
