import type { User } from "@/lib/db/schema";
import {
  getProgressEntriesByUserId,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import { canAccessProFeatures } from "@/lib/admin";
import { trendWeightInUnit } from "@/lib/goals/latest-weight";
import {
  distinctExerciseNames,
  toWorkoutData,
} from "@/lib/workouts/serialize";
import { prBaselineByExercise } from "@/lib/workouts/stats";

// Enough history for a solid e1RM baseline; matches the /goals page window.
const FORM_WORKOUT_LIMIT = 60;

export type GoalFormData = {
  exerciseNames: string[];
  currentWeight: { value: number; unit: "lb" | "kg" } | null;
  /** Current best est. 1RM (lb) per logged exercise, lowercased name. */
  liftE1rm: Record<string, number>;
  defaultUnit: "lb" | "kg";
};

/**
 * Everything the goal form's intelligence needs (MOB-19): the one-tap
 * current-weight prefill, lift baselines for feasibility, and the exercise
 * suggestions. Workout/weigh-in reads are Pro data; non-Pro members just get
 * an honest form without the prefills.
 */
export async function loadGoalFormData(user: User): Promise<GoalFormData> {
  const isPro = canAccessProFeatures(user);
  const defaultUnit: "lb" | "kg" = user.weightUnit ?? "lb";
  if (!isPro) {
    return { exerciseNames: [], currentWeight: null, liftE1rm: {}, defaultUnit };
  }

  const [rawWorkouts, entries] = await Promise.all([
    getWorkoutsByUserId(user.id, FORM_WORKOUT_LIMIT),
    getProgressEntriesByUserId(user.id),
  ]);
  const workouts = rawWorkouts.map(toWorkoutData);

  const liftE1rm: Record<string, number> = {};
  for (const [key, rec] of Object.entries(prBaselineByExercise(workouts))) {
    if (rec.bestE1RMLb > 0) {
      liftE1rm[key] = rec.bestE1RMLb;
    }
  }

  return {
    exerciseNames: distinctExerciseNames(workouts),
    currentWeight: trendWeightInUnit(entries, defaultUnit),
    liftE1rm,
    defaultUnit,
  };
}
