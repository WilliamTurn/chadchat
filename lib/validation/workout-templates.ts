import { z } from "zod";
import { EXERCISE_KINDS } from "@/lib/workouts/exercise-library";

/**
 * The structured shape of a workout template's exercises — the member-built
 * plan behind "My Workouts". One source of truth for the builder UI, the
 * saveTemplate server action, and the JSON column on WorkoutTemplate.
 *
 * Like WorkoutExercise, `name`/`muscleGroup`/`kind` are snapshots (not FKs) so
 * a template stays stable if a custom exercise is later renamed or deleted.
 */

export const templateExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  muscleGroup: z.string().trim().max(40).nullable().optional(),
  kind: z.enum(EXERCISE_KINDS).nullable().optional(),
  equipment: z.string().trim().max(40).nullable().optional(),
  targetSets: z.number().int().min(1).max(12),
  repRangeMin: z.number().int().min(1).max(99),
  repRangeMax: z.number().int().min(1).max(99),
  restSeconds: z.number().int().min(0).max(600),
  note: z.string().trim().max(200).nullable().optional(),
});

export type TemplateExercise = z.infer<typeof templateExerciseSchema>;

export const saveTemplateSchema = z.object({
  // Present when editing an existing template; absent when creating.
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name this workout.").max(60),
  exercises: z
    .array(templateExerciseSchema)
    .min(1, "Add at least one exercise.")
    .max(20),
});

export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>;

/** Parse a WorkoutTemplate row's raw `exercises` json (null if absent/bad). */
export function parseTemplateExercises(raw: unknown): TemplateExercise[] | null {
  const parsed = z.array(templateExerciseSchema).min(1).safeParse(raw);
  return parsed.success ? parsed.data : null;
}
