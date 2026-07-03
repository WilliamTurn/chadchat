import { generateObject } from "ai";
import { z } from "zod";
import { normalizePlanDays, type PlanDay } from "@/lib/validation/plan-days";
import { getLanguageModel } from "./providers";

// Extraction is a mechanical read of a plan Chad already wrote — a fast model
// is plenty (same tier the memory extractor uses), and it runs once per plan,
// then the result is cached on the Plan row.
const EXTRACT_MODEL_ID = "google/gemini-3.5-flash";

const extractionSchema = z.object({
  days: z.array(
    z.object({
      name: z
        .string()
        .describe('The day label, e.g. "Day 1: Upper" or "Day 3: Pull".'),
      exercises: z.array(
        z.object({
          name: z
            .string()
            .describe(
              'The exercise name exactly as commonly known, e.g. "Barbell Bench Press".'
            ),
          sets: z.number().int().describe("Prescribed number of working sets."),
          reps: z
            .string()
            .describe(
              'Prescribed reps as written: "4-6", "8-12", "AMRAP", "45s".'
            ),
          weight: z
            .number()
            .nullable()
            .describe(
              "Prescribed load as a number, ONLY if the plan names one. Null otherwise."
            ),
          unit: z.enum(["lb", "kg"]).describe("Unit of the prescribed load."),
          note: z
            .string()
            .nullable()
            .describe(
              'Short prescription note if the plan gives one: "RPE 8", "3 min rest". Null otherwise.'
            ),
        })
      ),
    })
  ),
});

/**
 * Read a free-text training plan and extract its structured, runnable days
 * (FN-2 backfill for plans saved before savePlan carried structure). Pure
 * extraction — nothing is invented: only days with concrete prescribed
 * exercises come back. Returns null when the text has no extractable program
 * (or the model/parse fails); callers treat null as "not runnable".
 */
export async function extractPlanDays(detail: string): Promise<PlanDay[] | null> {
  const trimmed = detail.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const { object } = await generateObject({
      model: getLanguageModel(EXTRACT_MODEL_ID),
      schema: extractionSchema,
      system: [
        "You extract the runnable training days from a written workout plan, so a lifter can start a day in a workout logger with the exercises pre-filled.",
        "Rules:",
        "- Extract ONLY what the plan prescribes. Never invent exercises, sets, reps, or weights.",
        "- One entry per TRAINING day. Skip rest days, warm-up-only notes, and general advice sections.",
        "- Keep the plan's own day labels ('Day 2: Lower'); if a day has no label, use its position ('Day 3').",
        "- Use each exercise's standard name (e.g. 'Romanian Deadlift', not 'RDLs').",
        "- `weight` is null unless the plan names a concrete load for that exercise.",
        "- If a plan section prescribes a rep RANGE, keep it as written ('4-6').",
        "- If the text contains no concrete day-by-day program, return an empty days array.",
      ].join("\n"),
      prompt: trimmed,
    });
    if (object.days.length === 0) {
      return null;
    }
    return normalizePlanDays(object.days);
  } catch (_error) {
    return null;
  }
}
