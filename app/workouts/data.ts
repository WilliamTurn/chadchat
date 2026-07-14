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
import { getApprovedExerciseAliases } from "@/lib/workouts/alias-queries";
import {
  canonicalizeWorkouts,
  type ResolveOptions,
} from "@/lib/workouts/exercise-identity";
import { toWorkoutData } from "@/lib/workouts/serialize";
import {
  lastSetsByExercise,
  prBaselineByExercise,
  type LastExerciseLog,
  type PrBaseline,
  type WeightUnit,
  type WorkoutData,
} from "@/lib/workouts/stats";
import { withAliasKeyEchoes } from "@/lib/workouts/training-analytics";

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
  /** History exactly as logged (display, editing, raw lookups). */
  workouts: WorkoutData[];
  /** History with exercise identities resolved (FIX-33/34): analytics
   *  (records, trends, per-exercise history) read THESE so aliases merge. */
  canonicalWorkouts: WorkoutData[];
  /** The member's identity-resolution inputs (server-side use only). */
  resolveOptions: ResolveOptions;
  customExercises: CustomExerciseData[];
  lastSets: Record<string, LastExerciseLog>;
  prBaseline: Record<string, PrBaseline>;
  unit: WeightUnit;
};

/** Everything the live-session screens need, in one load. */
export async function loadWorkoutContext(user: User): Promise<WorkoutContext> {
  const [rawWorkouts, customs, memberAliases] = await Promise.all([
    getWorkoutsByUserId(user.id, MAX_WORKOUTS),
    getCustomExercisesByUserId(user.id),
    getApprovedExerciseAliases(user.id),
  ]);
  const workouts = rawWorkouts.map(toWorkoutData);
  const resolveOptions: ResolveOptions = {
    memberCustomNames: customs.map((c) => c.name),
    memberAliases,
  };
  const canonicalWorkouts = canonicalizeWorkouts(workouts, resolveOptions);
  return {
    workouts,
    canonicalWorkouts,
    resolveOptions,
    customExercises: customs.map(toCustomExerciseData),
    // Maps compute over canonical history so bests/ghosts reconcile across
    // aliases, then echo the raw logged keys so the logger's raw-name
    // lookups (session-player, picker, prefill) keep hitting.
    lastSets: withAliasKeyEchoes(
      lastSetsByExercise(canonicalWorkouts),
      workouts,
      resolveOptions
    ),
    prBaseline: withAliasKeyEchoes(
      prBaselineByExercise(canonicalWorkouts),
      workouts,
      resolveOptions
    ),
    unit: user.weightUnit === "kg" ? "kg" : "lb",
  };
}
