// BLK-3 regression test. Run with: pnpm test:unit
//
// Guards the single most damaging chat bug found in the athlete audit: Gemini's
// internal reasoning + tool-selection scaffolding leaking verbatim into Chad's
// visible reply. This test FAILS if `default_api:`, `createDocument`, or
// `CRITICAL INSTRUCTION` ever survive the sanitizer into the user-visible text.

import assert from "node:assert/strict";
import { test } from "node:test";
import { stripModelInternals } from "../../lib/ai/sanitize-output";

// The forbidden internal markers that must never reach the transcript.
const FORBIDDEN = ["default_api:", "createDocument", "CRITICAL INSTRUCTION"];

function assertClean(output: string) {
  for (const token of FORBIDDEN) {
    assert.ok(
      !output.includes(token),
      `leaked internal token "${token}" survived sanitization:\n${output}`
    );
  }
}

test("strips the documented multi-line CoT / tool-plumbing leak", () => {
  const leaked = [
    "<ctrl94>thought CRITICAL INSTRUCTION 1: I must prioritize using the most specific tool.",
    "default_api:savePlan: Saves a full training or diet plan to the user's dashboard.",
    "createDocument: Creates an artifact.",
    "I will use default_api:savePlan now.",
    "",
    "Alright Marcus, here's your 5-day powerbuilding split. Stop making excuses and get under the bar.",
  ].join("\n");

  const out = stripModelInternals(leaked);
  assertClean(out);
  assert.ok(
    out.startsWith("Alright Marcus"),
    `real answer should be preserved, got:\n${out}`
  );
});

test("strips a run-on leak where the answer shares the line", () => {
  const leaked =
    "94>thought CRITICAL INSTRUCTION 1: I must prioritize the most specific tool. " +
    "I will use default_api:savePlan to save it. Confirm when you've read the plan.";

  const out = stripModelInternals(leaked);
  assertClean(out);
  assert.ok(out.includes("Confirm when you've read the plan."));
});

test("strips bare Gemini control tokens", () => {
  const out = stripModelInternals(
    "<ctrl94>Here is your plan.<ctrl95><end_of_turn>"
  );
  assert.equal(out, "Here is your plan.");
});

test("still strips the legacy <has_function_call> token", () => {
  assert.equal(
    stripModelInternals("Do this.<has_function_call>"),
    "Do this."
  );
});

test("leaves genuine coaching prose untouched", () => {
  const real =
    "Add 5 lbs to your bench and squat ONLY when you cleanly hit the top reps for every single set. " +
    "No sloppy reps. No ego lifting.\n\nThe plan is now live on your dashboard.";
  assert.equal(stripModelInternals(real), real);
});

test("does not eat the word 'document' or normal punctuation", () => {
  const real = "Read the plan document I built, then confirm. Critical: don't skip the deficit.";
  assert.equal(stripModelInternals(real), real);
});

test("handles empty / whitespace input", () => {
  assert.equal(stripModelInternals(""), "");
  assert.equal(stripModelInternals("   "), "");
});
