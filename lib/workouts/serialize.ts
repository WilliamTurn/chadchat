import type { WorkoutWithChildren } from "@/lib/db/queries";
import type { WorkoutData } from "@/lib/workouts/stats";

/**
 * DB workout rows → the serializable shape the pure stats helpers and client
 * charts consume. Shared by every page that hydrates workouts for lift-goal
 * trends (/today, /goals, /goals/[id]).
 */
export function toWorkoutData(w: WorkoutWithChildren): WorkoutData {
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

/**
 * Distinct exercise names across the logged workouts (case-insensitive,
 * first-seen casing wins), sorted: the add-a-lift-goal suggestions.
 */
export function distinctExerciseNames(workouts: WorkoutData[]): string[] {
  return [
    ...new Map(
      workouts
        .flatMap((w) => w.exercises.map((ex) => ex.name.trim()))
        .filter(Boolean)
        .map((name) => [name.toLowerCase(), name] as const)
    ).values(),
  ].sort((a, b) => a.localeCompare(b));
}
