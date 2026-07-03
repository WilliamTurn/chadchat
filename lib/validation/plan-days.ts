import { z } from "zod";
import { findBuiltInExercise } from "@/lib/workouts/exercise-library";

/**
 * The structured shape of a training plan's days — what makes a plan RUNNABLE
 * in the workout logger instead of a text document (FN-2). One source of truth
 * for: the savePlan chat tool (Chad emits days alongside the plan text), the
 * AI extraction pass that backfills older free-text plans, and the /workouts
 * "Start day" flow that pre-fills the logger.
 *
 * `reps` is a string, not a number, because real programming prescribes
 * ranges and non-rep work: "4-6", "8-12", "AMRAP", "45s", "5 per side".
 */

export const planDayExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sets: z.number().int().min(1).max(12),
  reps: z.string().trim().min(1).max(24),
  // Prescribed load, only when the plan names one ("185 lb").
  weight: z.number().min(0).max(10_000).nullable().optional(),
  unit: z.enum(["lb", "kg"]).optional(),
  // Short prescription note: "RPE 8", "3 min rest", "slow negative".
  note: z.string().trim().max(200).nullable().optional(),
});

export const planDaySchema = z.object({
  // "Day 1: Upper", "Day 3: Pull" — the label the member taps to start.
  name: z.string().trim().min(1).max(80),
  exercises: z.array(planDayExerciseSchema).min(1).max(15),
});

export const planDaysSchema = z.array(planDaySchema).min(1).max(7);

export type PlanDayExercise = z.infer<typeof planDayExerciseSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;

/**
 * Validate + tidy structured days before persisting. Snaps exercise names to
 * the built-in library's canonical casing when they match (so plan days join
 * cleanly with logged history for last-session ghosting and PR/1RM grouping).
 * Returns null instead of throwing — callers treat bad structure as "no days".
 */
export function normalizePlanDays(input: unknown): PlanDay[] | null {
  const parsed = planDaysSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.map((day) => ({
    name: day.name,
    exercises: day.exercises.map((ex) => {
      const builtIn = findBuiltInExercise(ex.name);
      return {
        name: builtIn?.name ?? ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight ?? null,
        unit: ex.unit ?? "lb",
        note: ex.note?.trim() ? ex.note.trim() : null,
      };
    }),
  }));
}

/** Parse a Plan row's raw `days` json column into typed days (null if absent/bad). */
export function parsePlanDays(raw: unknown): PlanDay[] | null {
  if (raw == null) {
    return null;
  }
  return normalizePlanDays(raw);
}

/** "4 x 4-6 @ 185 lb · RPE 8" — the one-line target shown in the logger. */
export function formatPlanTarget(ex: PlanDayExercise): string {
  let s = `${ex.sets} x ${ex.reps}`;
  if (ex.weight != null && ex.weight > 0) {
    s += ` @ ${ex.weight} ${ex.unit ?? "lb"}`;
  }
  if (ex.note) {
    s += ` · ${ex.note}`;
  }
  return s;
}
