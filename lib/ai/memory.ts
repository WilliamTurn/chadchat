import "server-only";

import { generateText } from "ai";
import { getUserMemory, upsertUserMemory } from "@/lib/db/queries";
import { memoryModel } from "./models";
import { getLanguageModel } from "./providers";

// Reliable Google Flash model for the background memory update. Memory is a
// crucial, accuracy-sensitive task — we deliberately do NOT use the cheap title
// model here, but we also don't need Chad's full flagship brain.
const MEMORY_MODEL_ID = memoryModel.id;

// Throttle: once a user has a profile, don't re-run extraction more often than
// this. Caps cost for heavy chatters; tune freely. (First-ever extraction for a
// user is never throttled.)
const MIN_SECONDS_BETWEEN_UPDATES = 60;

// Hard ceiling on the stored profile so the prompt injection stays cheap and
// the model is forced to keep it tight.
const MAX_PROFILE_CHARS = 4000;

// How many of the most recent messages to feed the updater. The profile is
// cumulative, so we only need the latest exchange(s) plus the existing profile.
const RECENT_MESSAGE_WINDOW = 12;

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

type TextualMessage = {
  role: string;
  parts?: unknown[];
};

/** Flatten UI message parts into a plain "Role: text" transcript for the updater. */
export function messagesToText(messages: TextualMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    const text = (m.parts ?? [])
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          (part as { type: unknown }).type === "text" &&
          "text" in part
        ) {
          return String((part as { text: unknown }).text ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
    if (text) {
      const who = m.role === "user" ? "Client" : "Chad";
      lines.push(`${who}: ${text}`);
    }
  }
  return lines.join("\n");
}

/** Format the stored profile for injection into Chad's system prompt. */
export function formatMemoryForPrompt(profile: string | null | undefined): string {
  const trimmed = profile?.trim();
  if (!trimmed) {
    return "";
  }
  return `WHAT YOU ALREADY KNOW ABOUT THIS CLIENT (from previous sessions — this is real, do not greet them as a stranger):

${trimmed}

Use what you know: skip re-asking for information you already have and pick up where you left off. If a detail looks stale or you have reason to doubt it, confirm it rather than assuming.`;
}

/**
 * Background memory update. Reads the existing profile + the recent conversation,
 * asks a cheap model to merge in any new durable facts, and saves the result.
 * Safe to fire-and-forget (e.g. via next/server `after`): it swallows its own
 * errors and never throws.
 */
export async function maybeUpdateUserMemory({
  userId,
  recentMessages,
}: {
  userId: string;
  recentMessages: TextualMessage[];
}): Promise<void> {
  try {
    const existing = await getUserMemory(userId);

    // Throttle: skip if we updated very recently (first-ever run is exempt).
    if (existing) {
      const ageSeconds = (Date.now() - existing.updatedAt.getTime()) / 1000;
      if (ageSeconds < MIN_SECONDS_BETWEEN_UPDATES) {
        return;
      }
    }

    const conversation = messagesToText(
      recentMessages.slice(-RECENT_MESSAGE_WINDOW)
    );
    if (!conversation.trim()) {
      return;
    }

    const existingProfile = existing?.profile?.trim() ?? "";

    const { text } = await generateText({
      model: getLanguageModel(MEMORY_MODEL_ID),
      system: MEMORY_SYSTEM_PROMPT,
      prompt: `EXISTING PROFILE:\n${existingProfile || "(none yet)"}\n\nRECENT CONVERSATION:\n${conversation}\n\nUPDATED PROFILE:`,
    });

    const updated = text.trim().slice(0, MAX_PROFILE_CHARS);

    // Don't overwrite a real profile with an empty/garbage response.
    if (!updated && existingProfile) {
      return;
    }

    if (updated && updated !== existingProfile) {
      await upsertUserMemory(userId, updated);
    }
  } catch (error) {
    // Memory is best-effort; never let it break the chat.
    console.error("Memory update failed:", error);
  }
}
