"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import { parseCalendarDay } from "@/lib/date";
import { extractPlanDays } from "@/lib/ai/plan-days";
import {
  createCustomExercise,
  createWorkout,
  deleteCustomExercise,
  deleteWorkout,
  getPlanById,
  getUserById,
  updateCustomExercise,
  updatePlanDays,
  updateWorkout,
} from "@/lib/db/queries";
import { parsePlanDays, type PlanDay } from "@/lib/validation/plan-days";
import {
  type CustomExerciseInput,
  customExerciseSchema,
  type SaveWorkoutInput,
  saveWorkoutSchema,
  type UpdateCustomExerciseInput,
  updateCustomExerciseSchema,
  type UpdateWorkoutInput,
  updateWorkoutSchema,
} from "@/lib/validation/workouts";

export type WorkoutActionState = { ok: boolean; error?: string };

const PRO_REQUIRED = "Workout logging is a Chad Pro feature.";

/** Resolve the signed-in user and confirm Pro on every action (not once). */
async function requirePro() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const user = await getUserById(session.user.id);
  if (!(user && canAccessProFeatures(user))) {
    return null;
  }
  return user;
}

/** Map validated input → the DB write payload (dates parsed, notes trimmed). */
function toWriteInput(
  userId: string,
  data: SaveWorkoutInput
): {
  userId: string;
  title: string;
  performedAt: Date;
  durationSeconds: number | null;
  notes: string | null;
  exercises: {
    name: string;
    muscleGroup: string | null;
    kind: "weighted" | "bodyweight" | "timed" | null;
    supersetGroup: number | null;
    notes: string | null;
    sets: {
      weight: number | null;
      reps: number | null;
      unit: "lb" | "kg";
      rpe: number | null;
      setType: "warmup" | "working" | "dropset" | "failure";
      completed: boolean;
    }[];
  }[];
} {
  const performedAt = parseCalendarDay(data.performedAt) ?? new Date();
  return {
    userId,
    title: data.title,
    performedAt,
    durationSeconds: data.durationSeconds ?? null,
    notes: data.notes?.trim() ? data.notes.trim() : null,
    exercises: data.exercises.map((ex) => ({
      name: ex.name,
      muscleGroup: ex.muscleGroup?.trim() ? ex.muscleGroup.trim() : null,
      kind: ex.kind ?? null,
      supersetGroup: ex.supersetGroup ?? null,
      notes: ex.notes?.trim() ? ex.notes.trim() : null,
      sets: ex.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        unit: s.unit,
        rpe: s.rpe ?? null,
        setType: s.setType,
        completed: s.completed,
      })),
    })),
  };
}

export async function saveWorkout(
  input: SaveWorkoutInput
): Promise<WorkoutActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const parsed = saveWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that workout.",
    };
  }

  await createWorkout(toWriteInput(user.id, parsed.data));
  revalidatePath("/workouts");
  revalidatePath("/today");
  return { ok: true };
}

export async function editWorkout(
  input: UpdateWorkoutInput
): Promise<WorkoutActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const parsed = updateWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't update that workout.",
    };
  }

  const { id, ...rest } = parsed.data;
  await updateWorkout({ ...toWriteInput(user.id, rest), id });
  revalidatePath("/workouts");
  revalidatePath("/today");
  return { ok: true };
}

export async function removeWorkout(id: string): Promise<WorkoutActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await deleteWorkout({ id, userId: user.id });
  revalidatePath("/workouts");
  revalidatePath("/today");
  return { ok: true };
}

export async function addCustomExercise(
  input: CustomExerciseInput
): Promise<WorkoutActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: PRO_REQUIRED };
  }
  const parsed = customExerciseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't add that exercise.",
    };
  }
  const { notes, ...rest } = parsed.data;
  await createCustomExercise({
    userId: user.id,
    ...rest,
    notes: notes?.trim() ? notes.trim() : null,
  });
  revalidatePath("/workouts");
  return { ok: true };
}

export async function editCustomExercise(
  input: UpdateCustomExerciseInput
): Promise<WorkoutActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: PRO_REQUIRED };
  }
  const parsed = updateCustomExerciseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't update that exercise.",
    };
  }
  const { id, notes, ...rest } = parsed.data;
  await updateCustomExercise({
    id,
    userId: user.id,
    ...rest,
    notes: notes?.trim() ? notes.trim() : null,
  });
  revalidatePath("/workouts");
  return { ok: true };
}

export async function removeCustomExercise(
  id: string
): Promise<WorkoutActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await deleteCustomExercise({ id, userId: user.id });
  revalidatePath("/workouts");
  return { ok: true };
}

export type SyncPlanDaysState =
  | { ok: true; days: PlanDay[] }
  | { ok: false; error: string };

/**
 * Backfill a training plan's structured runnable days from its free text
 * (FN-2). Plans saved by Chad since s134 carry `days` from birth; older ones
 * (and user-typed plans) get a one-time AI extraction here, cached on the Plan
 * row so it never runs twice. The Workouts page auto-invokes this when it sees
 * an active training plan without days.
 */
export async function syncPlanDays(planId: string): Promise<SyncPlanDaysState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const record = await getPlanById({ id: planId, userId: user.id });
  if (!record || record.kind !== "training") {
    return { ok: false, error: "That training plan wasn't found." };
  }

  // Already structured (a concurrent sync or a Chad-saved plan) — reuse it.
  const existing = parsePlanDays(record.days);
  if (existing) {
    return { ok: true, days: existing };
  }

  const days = await extractPlanDays(record.detail);
  if (!days) {
    return {
      ok: false,
      error:
        "Couldn't read a day-by-day program out of this plan. Ask Chad to rewrite it with concrete days, exercises, and sets.",
    };
  }

  await updatePlanDays({ id: record.id, userId: user.id, days });
  revalidatePath("/workouts");
  return { ok: true, days };
}
