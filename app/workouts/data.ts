import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { toCustomExerciseData, type CustomExerciseData } from "@/components/workouts/v2/catalog";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getCustomExercisesByUserId,
  getWorkoutsByUserId,
  getUserById,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { toWorkoutData } from "@/lib/workouts/serialize";
import {
  lastSetsByExercise,
  prBaselineByExercise,
  type LastExerciseLog,
  type PrBaseline,
  type WeightUnit,
  type WorkoutData,
} from "@/lib/workouts/stats";

// Cap the history we hydrate per page load. Generous (years of training at a
// session a day) but bounds an otherwise unbounded query + payload.
export const MAX_WORKOUTS = 200;

/**
 * Auth + tier gating shared by every /workouts page. Sub-pages send non-Pro
 * members to /workouts, which renders the upgrade prompt.
 */
export async function requireWorkoutsUser(): Promise<User> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }
  if (!canAccessProFeatures(user)) {
    redirect("/workouts");
  }
  return user;
}

export type WorkoutContext = {
  workouts: WorkoutData[];
  customExercises: CustomExerciseData[];
  lastSets: Record<string, LastExerciseLog>;
  prBaseline: Record<string, PrBaseline>;
  unit: WeightUnit;
};

/** Everything the live-session screens need, in one load. */
export async function loadWorkoutContext(user: User): Promise<WorkoutContext> {
  const [rawWorkouts, customs] = await Promise.all([
    getWorkoutsByUserId(user.id, MAX_WORKOUTS),
    getCustomExercisesByUserId(user.id),
  ]);
  const workouts = rawWorkouts.map(toWorkoutData);
  return {
    workouts,
    customExercises: customs.map(toCustomExerciseData),
    lastSets: lastSetsByExercise(workouts),
    prBaseline: prBaselineByExercise(workouts),
    unit: user.weightUnit === "kg" ? "kg" : "lb",
  };
}
