import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftDurationSeconds } from "@/components/workouts/v2/format";

// Regression cover for the W1 finish-step port: the duration parser moved
// from session-player.tsx into format.ts unchanged. What the member types in
// the finish step's min/sec fields is what saves, clamped to a sane day.
describe("draftDurationSeconds", () => {
  it("combines minutes and seconds", () => {
    assert.equal(draftDurationSeconds({ min: "10", sec: "30" }), 630);
  });

  it("treats empty or non-numeric parts as zero", () => {
    assert.equal(draftDurationSeconds({ min: "", sec: "" }), 0);
    assert.equal(draftDurationSeconds({ min: "abc", sec: "5" }), 5);
    assert.equal(draftDurationSeconds({ min: "2", sec: "" }), 120);
  });

  it("clamps to the 24-hour cap", () => {
    assert.equal(draftDurationSeconds({ min: "9999", sec: "59" }), 86_400);
  });

  it("never returns a negative duration", () => {
    assert.equal(draftDurationSeconds({ min: "-5", sec: "0" }), 0);
  });
});
