import "server-only";

import { generateText } from "ai";
import { formatCalendarDay } from "@/lib/date";
import type { WorkoutWithChildren } from "@/lib/db/queries";
import { getUserMemory, upsertUserMemory } from "@/lib/db/queries";
import type { Goal, MealPlan, Plan } from "@/lib/db/schema";
import { planDaysSchema } from "@/lib/validation/meal-plan";
import {
  computePersonalRecords,
  toLb,
  type WorkoutData,
  workoutVolumeLb,
} from "@/lib/workouts/stats";
import { memoryModel } from "./models";
import { getLanguageModel } from "./providers";

// Keep the injected goals/plans block tight so it never bloats the prompt:
// only active records, capped count, each detail truncated.
const MAX_GOALS_IN_PROMPT = 5;
const MAX_PLANS_IN_PROMPT = 5;
const MAX_DETAIL_CHARS_IN_PROMPT = 800;
// How many recent workouts + PRs to surface to Chad.
const MAX_WORKOUTS_IN_PROMPT = 5;
const MAX_PRS_IN_PROMPT = 6;
const MAX_EXERCISES_PER_WORKOUT_IN_PROMPT = 6;

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
export function formatMemoryForPrompt(
  profile: string | null | undefined
): string {
  const trimmed = profile?.trim();
  if (!trimmed) {
    return "";
  }
  return `WHAT YOU ALREADY KNOW ABOUT THIS CLIENT (from previous sessions — this is real, do not greet them as a stranger):

${trimmed}

Use what you know: skip re-asking for information you already have and pick up where you left off. If a detail looks stale or you have reason to doubt it, confirm it rather than assuming.`;
}

function truncateDetail(detail: string): string {
  const trimmed = detail.trim();
  if (trimmed.length <= MAX_DETAIL_CHARS_IN_PROMPT) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_DETAIL_CHARS_IN_PROMPT)}…`;
}

/**
 * Format the user's active goals and plans for injection into Chad's system
 * prompt. Unlike memory (a compressed summary), these are the explicit, full
 * documents the user saved — so Chad references and builds on them directly.
 * Loaded regardless of the memory toggle. Returns "" when there's nothing.
 */
export function formatGoalsForPrompt(goals: Goal[], plans: Plan[]): string {
  const activeGoals = goals
    .filter((g) => g.status === "active")
    .slice(0, MAX_GOALS_IN_PROMPT);
  const activePlans = plans
    .filter((p) => p.status === "active")
    .slice(0, MAX_PLANS_IN_PROMPT);

  if (activeGoals.length === 0 && activePlans.length === 0) {
    return "";
  }

  const sections: string[] = [];

  if (activeGoals.length > 0) {
    const lines = activeGoals.map((g) => {
      const target = g.targetDate ? ` (target: ${g.targetDate})` : "";
      const detail = g.detail.trim() ? `\n${truncateDetail(g.detail)}` : "";
      return `- ${g.title}${target}${detail}`;
    });
    sections.push(`THIS CLIENT'S GOALS:\n${lines.join("\n")}`);
  }

  if (activePlans.length > 0) {
    const lines = activePlans.map((p) => {
      const detail = p.detail.trim() ? `\n${truncateDetail(p.detail)}` : "";
      return `- [${p.kind}] ${p.title}${detail}`;
    });
    sections.push(`THIS CLIENT'S CURRENT PLANS:\n${lines.join("\n")}`);
  }

  return `GOALS & PLANS THIS CLIENT HAS SAVED IN THE APP (they set these deliberately — treat them as current and authoritative; reference and build on them, and don't re-ask for what's already here):

${sections.join("\n\n")}`;
}

/**
 * Summarize the client's active structured meal plan for Chad's prompt so he
 * knows what he's already got them eating and can coach against it (without
 * re-asking or contradicting his own plan). Kept compact: title, daily target,
 * and a one-line-per-meal breakdown of the first day as a representative day —
 * the full multi-day plan lives on the /meal-plan page they can open. Returns ""
 * when there's no active plan. Macros come straight from the stored, DB-verified
 * totals — never re-estimated.
 */
export function formatMealPlanForPrompt(
  plan: MealPlan | null | undefined
): string {
  if (!plan) {
    return "";
  }
  const parsed = planDaysSchema.safeParse(plan.days);
  if (!parsed.success || parsed.data.length === 0) {
    return "";
  }

  const targetLine =
    plan.targetCalories != null
      ? `Daily target: ${plan.targetCalories.toLocaleString()} kcal — ${plan.targetProtein ?? 0}P / ${plan.targetCarbs ?? 0}C / ${plan.targetFat ?? 0}F.`
      : "";

  const sample = parsed.data[0];
  const mealLines = sample.meals.map(
    (m) =>
      `  - ${m.title} (${Math.round(m.totals.calories).toLocaleString()} kcal, ${Math.round(m.totals.protein)}P)`
  );

  const dayCount = parsed.data.length;
  const scope =
    dayCount > 1
      ? `It's a ${dayCount}-day plan; here is "${sample.label}" as a sample day:`
      : "The plan:";

  return `THIS CLIENT'S ACTIVE MEAL PLAN (Chad built this structured plan with real foods + DB-verified macros — it lives on their Meal Plan page where they can view, edit portions, log meals as eaten, or regenerate it; reference it and hold them to it, don't re-invent it):

"${plan.title}"
${targetLine}
${scope}
${mealLines.join("\n")}`;
}

function toWorkoutData(w: WorkoutWithChildren): WorkoutData {
  return {
    id: w.id,
    title: w.title,
    performedAt: w.performedAt.toISOString(),
    durationSeconds: w.durationSeconds,
    notes: w.notes,
    exercises: w.exercises.map((ex) => ({
      name: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      notes: ex.notes,
      sets: ex.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        unit: s.unit,
        rpe: s.rpe,
        setType: s.setType,
        completed: s.completed,
      })),
    })),
  };
}

function shortDate(iso: string): string {
  return formatCalendarDay(new Date(iso));
}

/**
 * Summarize the client's recently logged workouts + their lifting PRs for
 * Chad's prompt, so he can reference real training and hold them accountable.
 * These are explicit logs (not memory) — loaded regardless of the memory
 * toggle. Returns "" when nothing's been logged. Kept compact (a handful of
 * sessions + top PRs) to avoid prompt bloat.
 */
export function formatWorkoutsForPrompt(
  workouts: WorkoutWithChildren[]
): string {
  if (workouts.length === 0) {
    return "";
  }

  const data = workouts.map(toWorkoutData);
  // workouts arrive newest-first from the query.
  const recent = data.slice(0, MAX_WORKOUTS_IN_PROMPT);

  const workoutLines = recent.map((w) => {
    const volume = workoutVolumeLb(w);
    const exParts = w.exercises
      .slice(0, MAX_EXERCISES_PER_WORKOUT_IN_PROMPT)
      .map((ex) => {
        const working = ex.sets.filter(
          (s) => s.completed && s.setType !== "warmup"
        );
        if (working.length === 0) {
          return ex.name;
        }
        const top = working.reduce((a, b) =>
          toLb(b.weight ?? 0, b.unit) > toLb(a.weight ?? 0, a.unit) ? b : a
        );
        const load = top.weight == null ? "BW" : `${top.weight}${top.unit}`;
        const reps = top.reps == null ? "" : `×${top.reps}`;
        return `${ex.name} ${working.length} set${working.length === 1 ? "" : "s"} (top ${load}${reps})`;
      });
    const volStr = volume > 0 ? `, ${volume.toLocaleString()} lb volume` : "";
    return `- ${shortDate(w.performedAt)} · ${w.title} (${exParts.length} exercise${exParts.length === 1 ? "" : "s"}${volStr}): ${exParts.join("; ")}`;
  });

  const prs = computePersonalRecords(data)
    .filter((p) => p.bestEst1RM != null)
    .slice(0, MAX_PRS_IN_PROMPT)
    .map((p) => {
      const best =
        p.bestWeight == null
          ? ""
          : ` (best set ${p.bestWeight}${p.bestWeightUnit}${p.bestWeightReps == null ? "" : ` × ${p.bestWeightReps}`})`;
      return `- ${p.exerciseName}: est. 1RM ~${p.bestEst1RM} lb${best}`;
    });

  const sections = [
    `RECENT WORKOUTS THIS CLIENT HAS LOGGED (their real training — reference it, hold them to it, and progress it):\n${workoutLines.join("\n")}`,
  ];
  if (prs.length > 0) {
    sections.push(
      `THEIR LIFTING PRs (estimated 1-rep maxes):\n${prs.join("\n")}`
    );
  }

  return sections.join("\n\n");
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
