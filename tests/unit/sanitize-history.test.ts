// CHT-10 regression tests. Run with: pnpm test:unit
//
// Guards the intermittent Gemini stream-error class: a follow-up turn in a
// tool-history chat 400ing at the gateway (vertex "must include at least one
// parts field" from an empty persisted assistant turn; google "Corrupted
// thought signature" from stale reasoning/tool provider metadata resent from
// a previous turn). The sanitizer repairs the history before it's converted
// to model messages; persistence keeps the original messages.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasPersistableParts,
  sanitizeHistoryForModel,
} from "../../lib/ai/sanitize-history";
import type { ChatMessage } from "../../lib/types";

const user = (id: string, text: string): ChatMessage =>
  ({
    id,
    role: "user",
    parts: [{ type: "text", text }],
  }) as ChatMessage;

const assistant = (id: string, parts: unknown[]): ChatMessage =>
  ({
    id,
    role: "assistant",
    parts,
  }) as ChatMessage;

test("drops an assistant husk that has only a step-start part", () => {
  const history = [
    user("u1", "hi"),
    assistant("a1", [{ type: "step-start" }]),
    user("u2", "follow-up"),
  ];
  const out = sanitizeHistoryForModel(history);
  assert.deepEqual(
    out.map((m) => m.id),
    ["u1", "u2"]
  );
});

test("drops an assistant message whose only text is empty", () => {
  const history = [
    user("u1", "hi"),
    assistant("a1", [{ type: "step-start" }, { type: "text", text: "  " }]),
    user("u2", "again"),
  ];
  const out = sanitizeHistoryForModel(history);
  assert.deepEqual(
    out.map((m) => m.id),
    ["u1", "u2"]
  );
});

test("strips reasoning parts + provider metadata from previous turns only", () => {
  const history = [
    user("u1", "plan my day"),
    assistant("a1", [
      {
        type: "reasoning",
        text: "internal monologue",
        providerMetadata: { google: { thoughtSignature: "stale-sig" } },
      },
      {
        type: "text",
        text: "Here's the plan.",
        providerMetadata: { google: { thoughtSignature: "stale-sig-2" } },
      },
      {
        type: "tool-getDashboard",
        toolCallId: "t1",
        state: "output-available",
        input: {},
        output: { ok: true },
        callProviderMetadata: { google: { thoughtSignature: "stale-sig-3" } },
      },
    ]),
    user("u2", "and tomorrow?"),
    // Current turn (after the last user message): must be left untouched —
    // Gemini validates the signature on an in-flight function call.
    assistant("a2", [
      {
        type: "tool-logMeal",
        toolCallId: "t2",
        state: "approval-responded",
        input: {},
        callProviderMetadata: { google: { thoughtSignature: "live-sig" } },
      },
    ]),
  ];

  const out = sanitizeHistoryForModel(history);
  const prior = out.find((m) => m.id === "a1");
  assert.ok(prior);
  assert.equal(
    prior.parts.some((p) => p.type === "reasoning"),
    false,
    "previous-turn reasoning must be dropped"
  );
  for (const part of prior.parts) {
    const record = part as Record<string, unknown>;
    assert.equal(record.providerMetadata, undefined);
    assert.equal(record.callProviderMetadata, undefined);
  }

  const current = out.find((m) => m.id === "a2");
  assert.ok(current);
  const currentPart = current.parts[0] as Record<string, unknown>;
  assert.deepEqual(currentPart.callProviderMetadata, {
    google: { thoughtSignature: "live-sig" },
  });
});

test("keeps a healthy history unchanged", () => {
  const history = [
    user("u1", "hi"),
    assistant("a1", [{ type: "text", text: "What's up." }]),
    user("u2", "log my water"),
  ];
  const out = sanitizeHistoryForModel(history);
  assert.deepEqual(out, history);
});

test("hasPersistableParts rejects husks and accepts real content", () => {
  assert.equal(
    hasPersistableParts({ parts: [{ type: "step-start" }] } as ChatMessage),
    false
  );
  assert.equal(
    hasPersistableParts({
      parts: [{ type: "step-start" }, { type: "text", text: "" }],
    } as ChatMessage),
    false
  );
  assert.equal(
    hasPersistableParts({
      parts: [{ type: "text", text: "Real answer." }],
    } as ChatMessage),
    true
  );
  // Reasoning renders in the UI, so a reasoning-only message is persistable.
  assert.equal(
    hasPersistableParts({
      parts: [{ type: "reasoning", text: "thinking…" }],
    } as ChatMessage),
    true
  );
});
