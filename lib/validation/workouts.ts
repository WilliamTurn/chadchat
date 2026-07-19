import { z } from "zod";
import {
  EQUIPMENT,
  EXERCISE_KINDS,
  MUSCLE_GROUPS,
} from "@/lib/workouts/exercise-library";

export const SET_TYPES = ["warmup", "working", "dropset", "failure"] as const;

const setSchema = z.object({
  weight: z.number().min(0).max(10_000).nullable(),
  reps: z.number().int().min(0).max(10_000).nullable(),
  unit: z.enum(["lb", "kg"]).default("lb"),
  rpe: z.number().min(1).max(10).nullable().optional(),
  setType: z.enum(SET_TYPES).default("working"),
  completed: z.boolean().default(true),
});

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Pick an exercise.").max(120),
  muscleGroup: z.string().trim().max(40).nullable().optional(),
  // Logging kind snapshot ("weighted" | "bodyweight" | "timed"); null on
  // pre-existing logs (treated as weighted).
  kind: z.enum(EXERCISE_KINDS).nullable().optional(),
  // Superset/circuit grouping (FEAT-10): consecutive exercises sharing the
  // same number were performed back-to-back; null/absent = standalone.
  supersetGroup: z.number().int().min(1).max(50).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  sets: z.array(setSchema).min(1).max(40),
});

export const saveWorkoutSchema = z.object({
  title: z.string().trim().min(1, "Name this workout.").max(120),
  performedAt: z.string().optional(),
  durationSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  exercises: z.array(exerciseSchema).min(1, "Add at least one exercise.").max(50),
});

export type SaveWorkoutInput = z.infer<typeof saveWorkoutSchema>;

/** The Phase 3 cardio quick-log: a catalog activity + minutes, with an
 * optional effort variant. The action validates the ids against
 * lib/energy/activity-catalog.ts server-side. */
export const logCardioSchema = z.object({
  activityId: z.string().trim().min(1, "Pick an activity.").max(60),
  variantId: z.string().trim().min(1).max(60).optional(),
  minutes: z
    .number({ invalid_type_error: "Enter how many minutes." })
    .int("Whole minutes only.")
    .min(1, "Enter how many minutes.")
    .max(1440, "That is more than a day. Check the minutes."),
  /** Member-local calendar day (yyyy-mm-dd); omitted = today. */
  performedAt: z.string().optional(),
});

export type LogCardioInput = z.infer<typeof logCardioSchema>;

/** The prescribed plan session a saved workout was started from (FIX-28);
 * the save action records a PlanSessionCompletion event from it. */
export const planCompletionRefSchema = z.object({
  planId: z.string().uuid(),
  planSessionId: z.string().uuid(),
  sessionName: z.string().trim().min(1).max(80),
});

export type PlanCompletionRef = z.infer<typeof planCompletionRefSchema>;

export const updateWorkoutSchema = saveWorkoutSchema.extend({
  id: z.string().uuid(),
});

export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;

export const customExerciseSchema = z.object({
  name: z.string().trim().min(1, "Name the exercise.").max(120),
  muscleGroup: z.enum(MUSCLE_GROUPS).default("other"),
  equipment: z.enum(EQUIPMENT).default("other"),
  kind: z.enum(EXERCISE_KINDS).default("weighted"),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;

export const updateCustomExerciseSchema = customExerciseSchema.extend({
  id: z.string().uuid(),
});

export type UpdateCustomExerciseInput = z.infer<
  typeof updateCustomExerciseSchema
>;
