import { z } from "zod";
import { EQUIPMENT, MUSCLE_GROUPS } from "@/lib/workouts/exercise-library";

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

export const updateWorkoutSchema = saveWorkoutSchema.extend({
  id: z.string().uuid(),
});

export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;

export const customExerciseSchema = z.object({
  name: z.string().trim().min(1, "Name the exercise.").max(120),
  muscleGroup: z.enum(MUSCLE_GROUPS).default("other"),
  equipment: z.enum(EQUIPMENT).default("other"),
});

export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;
