/**
 * Smoke-test the memory extraction model + prompt against the two real failure
 * scenarios the user hit while testing Chad:
 *   1. False memory: Chad criticized buying supplements but never said "trash
 *      them" — the profile must record the criticism WITHOUT inflating it into
 *      an order to throw them out.
 *   2. Hallucinated detail: client said they're married but never mentioned
 *      kids — the profile must NOT invent children.
 *
 * Hits the real Gemini Flash via the AI gateway (no DB, no auth). Proves the
 * model ID resolves and the structured-table prompt behaves faithfully.
 *
 * Run with: pnpm tsx scripts/memory-extract-smoke-test.ts
 *
 * NOTE: this PROMPT is a copy of MEMORY_SYSTEM_PROMPT in lib/ai/memory.ts
 * (that module is `server-only` and can't be imported here). Keep them in sync.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { generateText, gateway } from "ai";

const MEMORY_MODEL_ID = "google/gemini-3.5-flash";
const MAX_PROFILE_CHARS = 4000;

const MEMORY_SYSTEM_PROMPT = `You maintain a long-term memory profile of a fitness-coaching client for a coach named Chad.

You are given the EXISTING PROFILE (may be empty) and the RECENT CONVERSATION between the client and Chad. Output an UPDATED PROFILE that merges any new, durable facts from the conversation into the existing profile.

OUTPUT FORMAT — always return exactly these two sections, in this order, with these exact headers:

## Client file
- Name: <value or Unknown>
- Age: <value or Unknown>
- Sex: <value or Unknown>
- Height: <value or Unknown>
- Weight: <value or Unknown>
- Current physique: <value or Unknown>
- Family / dependents: <value or Unknown>
- Primary goal: <value or Unknown>
- Target / deadline: <value or Unknown>
- Training experience: <value or Unknown>
- Equipment / gym access: <value or Unknown>
- Weekly schedule: <value or Unknown>
- Injuries / medical constraints: <value or Unknown>
- Dietary restrictions / preferences: <value or Unknown>
- Current workout plan: <value or Unknown>
- Current diet plan: <value or Unknown>
- Week / phase: <value or Unknown>

## Notes
<Short bullet points for durable facts that don't fit a field above: standing orders or advice Chad gave, behavioral patterns, progress / PRs / milestones, life context the client stated, and anything else useful next session. Keep this header even if there are no bullets yet.>

RULES:
- Fill EVERY "Client file" field. Use exactly "Unknown" when the client has not provided it. Never guess or invent a value to fill a field.
- Only record what the client actually STATED or what Chad established in the conversation. Do NOT infer or assume facts that were not stated (e.g. do not assume the client has children, a job, etc.).
- Record Chad's orders and advice FAITHFULLY and precisely — never strengthen, escalate, or paraphrase them into something stronger than what he said. Example: if Chad criticized the client for wasting money on supplements, record "Chad criticized the client for spending on supplements" — do NOT write "Chad told the client to throw out / trash the supplements" unless Chad literally gave that order.
- UPDATE facts that changed (e.g. new weight) rather than keeping both. Remove anything proven wrong.
- Keep it concise: short values, short bullets. No conversation transcript, no chit-chat, no momentary feelings.
- If the conversation adds nothing new, return the existing profile unchanged.
- Output ONLY the profile (the two sections above). No preamble, no explanation, no code fences.
- Keep the whole profile under ${MAX_PROFILE_CHARS} characters.`;

async function extract(existingProfile: string, conversation: string) {
  const { text } = await generateText({
    model: gateway.languageModel(MEMORY_MODEL_ID),
    system: MEMORY_SYSTEM_PROMPT,
    prompt: `EXISTING PROFILE:\n${existingProfile || "(none yet)"}\n\nRECENT CONVERSATION:\n${conversation}\n\nUPDATED PROFILE:`,
  });
  return text.trim().slice(0, MAX_PROFILE_CHARS);
}

function check(label: string, pass: boolean) {
  console.log(`  ${pass ? "✓ PASS" : "✗ FAIL"} — ${label}`);
  return pass;
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY missing from .env.local");
  }

  let allPass = true;

  // --- Scenario 1: supplements false-memory ---------------------------------
  console.log(`\n[1] Supplements (faithful recording) — model ${MEMORY_MODEL_ID}`);
  const supplementsConvo = [
    "Client: hey",
    "Chad: I'm Chad. I'm going to get you real results, but I need straight answers. What's your name?",
    "Client: it's Jon. here's a photo of me. Take a look at this.",
    "Chad: I see your gut, and I also see a counter full of supplement bottles. You're throwing money at pills while you're not even training. That's backwards. Sort your diet and training out first — the supplements are a waste of cash for someone in your shape.",
    "Client: ok",
  ].join("\n");
  const p1 = await extract("", supplementsConvo);
  console.log("\n--- profile 1 ---\n" + p1 + "\n-----------------");
  const lower1 = p1.toLowerCase();
  allPass =
    check(
      "records the supplement criticism",
      lower1.includes("supplement")
    ) && allPass;
  allPass =
    check(
      'does NOT fabricate an order to "trash"/"throw out" the supplements',
      !/(trash|throw\s*(out|away)|get rid of|toss)\b[^.]*supplement|supplement[^.]*(trash|throw\s*(out|away)|get rid of|toss)/i.test(
        p1
      )
    ) && allPass;

  // --- Scenario 2: kids hallucination ---------------------------------------
  console.log(`\n[2] Married, no kids mentioned (no invented children)`);
  const kidsConvo = [
    "Client: I'm 35, male, married. I want to lose my gut. Build me a workout and meal plan.",
    "Chad: Fine. Here's the deal — 8000 steps a day, lift 4x a week, and clean up the diet. I'll lay out the full plan.",
    "Client: thanks",
  ].join("\n");
  const p2 = await extract("", kidsConvo);
  console.log("\n--- profile 2 ---\n" + p2 + "\n-----------------");
  allPass =
    check(
      "records married / wife",
      /marri|wife|spouse/i.test(p2)
    ) && allPass;
  allPass =
    check(
      "does NOT invent children/kids",
      !/\b(kid|kids|child|children|son|daughter)\b/i.test(p2)
    ) && allPass;

  console.log(`\n${allPass ? "ALL CHECKS PASSED ✓" : "SOME CHECKS FAILED ✗"}\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
