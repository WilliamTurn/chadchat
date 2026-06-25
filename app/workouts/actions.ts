"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import { parseCalendarDay } from "@/lib/date";
import {
  createCustomExercise,
  createWorkout,
  deleteCustomExercise,
  deleteWorkout,
  getUserById,
  updateWorkout,
} from "@/lib/db/queries";
import {
  type CustomExerciseInput,
  customExerciseSchema,
  type SaveWorkoutInput,
  saveWorkoutSchema,
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
  await createCustomExercise({ userId: user.id, ...parsed.data });
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
