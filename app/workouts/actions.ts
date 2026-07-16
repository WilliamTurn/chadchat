"use server";

import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import { calendarDayAnchorInTz, parseCalendarDay, toCalendarDayISO } from "@/lib/date";
import { extractPlanDays } from "@/lib/ai/plan-days";
import { recordPlanSessionCompletion } from "@/lib/db/plan-goal-queries";
import { applyMutationReceipt } from "@/lib/refresh/coordinator";
import { loggingReceipt, mutationReceipt } from "@/lib/refresh/receipt";
import {
  createCustomExercise,
  createWorkout,
  createWorkoutTemplate,
  deleteCustomExercise,
  getCustomExercisesByUserId,
  deleteWorkout,
  deleteWorkoutTemplate,
  getPlanById,
  getUserById,
  getWorkoutTemplateById,
  touchWorkoutTemplatePerformed,
  updateCustomExercise,
  updatePlanDays,
  updateWorkout,
  updateWorkoutTemplate,
} from "@/lib/db/queries";
import { parsePlanDays, type PlanDay } from "@/lib/validation/plan-days";
import {
  type SaveTemplateInput,
  saveTemplateSchema,
} from "@/lib/validation/workout-templates";
import {
  type CustomExerciseInput,
  customExerciseSchema,
  type PlanCompletionRef,
  planCompletionRefSchema,
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

export type SaveWorkoutResult = WorkoutActionState & { id?: string };

/**
 * Save a finished session. `templateId` (optional) is the "My Workouts"
 * template the session was started from, it gets its lastPerformedAt stamped
 * so the list can show "Last done Tuesday". Returns the new workout's id so
 * the player can land on /workouts/history/[id]?new=1.
 */
export async function saveWorkout(
  input: SaveWorkoutInput,
  templateId?: string,
  planRef?: PlanCompletionRef
): Promise<SaveWorkoutResult> {
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

  const created = await createWorkout(toWriteInput(user.id, parsed.data));
  if (templateId) {
    await touchWorkoutTemplatePerformed({
      id: templateId,
      userId: user.id,
      when: created.performedAt,
    });
  }
  // FIX-28: the session was started from a prescribed plan day, so record
  // the completion event (idempotent on workoutId; session ownership is
  // verified in the query). Best-effort on purpose: adherence bookkeeping
  // must never fail the member's saved workout.
  let completedPlanSession = false;
  if (planRef) {
    const ref = planCompletionRefSchema.safeParse(planRef);
    if (ref.success) {
      try {
        await recordPlanSessionCompletion({
          userId: user.id,
          planId: ref.data.planId,
          planSessionId: ref.data.planSessionId,
          workoutId: created.id,
          sessionName: ref.data.sessionName,
          completedDay: calendarDayAnchorInTz(
            created.performedAt,
            user.timezone
          ),
        });
        completedPlanSession = true;
      } catch (_error) {
        // The workout save stands; the plan card simply shows no completion.
      }
    }
  }
  applyMutationReceipt(
    loggingReceipt({
      domain: "training",
      entity: "workout",
      op: "create",
      // performedAt is a raw instant for logged-now sessions; the receipt day
      // is the MEMBER-LOCAL day of that instant (grain law), never the UTC day.
      days: {
        startISO: toCalendarDayISO(
          calendarDayAnchorInTz(created.performedAt, user.timezone)
        ),
      },
      alsoDomains: completedPlanSession ? ["plans"] : undefined,
    })
  );
  return { ok: true, id: created.id };
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
  applyMutationReceipt(
    loggingReceipt({ domain: "training", entity: "workout", op: "update" })
  );
  return { ok: true };
}

export async function removeWorkout(id: string): Promise<WorkoutActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await deleteWorkout({ id, userId: user.id });
  applyMutationReceipt(
    loggingReceipt({ domain: "training", entity: "workout", op: "delete" })
  );
  return { ok: true };
}

export type SaveTemplateResult = WorkoutActionState & { id?: string };

/** Create or update a "My Workouts" template (the member-built plan). */
export async function saveTemplate(
  input: SaveTemplateInput
): Promise<SaveTemplateResult> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: PRO_REQUIRED };
  }
  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Couldn't save that workout.",
    };
  }

  const { id, name, exercises } = parsed.data;
  if (id) {
    const existing = await getWorkoutTemplateById({ id, userId: user.id });
    if (!existing) {
      return { ok: false, error: "That workout wasn't found." };
    }
    await updateWorkoutTemplate({ id, userId: user.id, name, exercises });
    applyMutationReceipt(
      mutationReceipt({
        domain: "training",
        entity: "workoutTemplate",
        op: "update",
      })
    );
    return { ok: true, id };
  }

  const created = await createWorkoutTemplate({
    userId: user.id,
    name,
    exercises,
  });
  applyMutationReceipt(
    mutationReceipt({
      domain: "training",
      entity: "workoutTemplate",
      op: "create",
    })
  );
  return { ok: true, id: created.id };
}

export async function removeTemplate(id: string): Promise<WorkoutActionState> {
  const user = await requirePro();
  if (!user) {
    return { ok: false, error: "Not authorized." };
  }
  await deleteWorkoutTemplate({ id, userId: user.id });
  applyMutationReceipt(
    mutationReceipt({
      domain: "training",
      entity: "workoutTemplate",
      op: "delete",
    })
  );
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
  // Identity is the exercise NAME everywhere downstream (history, records,
  // the picker), so a second exercise with the same name would be
  // indistinguishable from the first. Refuse it (flaws XCU-13/XPK-14).
  const key = rest.name.trim().toLowerCase();
  const existing = await getCustomExercisesByUserId(user.id);
  if (existing.some((e) => e.name.trim().toLowerCase() === key)) {
    return {
      ok: false,
      error: `You already have an exercise named "${rest.name.trim()}". Edit that one, or pick a different name.`,
    };
  }
  await createCustomExercise({
    userId: user.id,
    ...rest,
    notes: notes?.trim() ? notes.trim() : null,
  });
  revalidateExercisePages();
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
  const key = rest.name.trim().toLowerCase();
  const existing = await getCustomExercisesByUserId(user.id);
  if (
    existing.some(
      (e) => e.id !== id && e.name.trim().toLowerCase() === key
    )
  ) {
    return {
      ok: false,
      error: `You already have an exercise named "${rest.name.trim()}". Pick a different name.`,
    };
  }
  await updateCustomExercise({
    id,
    userId: user.id,
    ...rest,
    notes: notes?.trim() ? notes.trim() : null,
  });
  revalidateExercisePages();
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
  revalidateExercisePages();
  return { ok: true };
}

/** Custom-exercise edits surface on every page that renders the library. */
function revalidateExercisePages() {
  applyMutationReceipt(
    mutationReceipt({
      domain: "training",
      entity: "customExercise",
      op: "update",
    })
  );
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

  // Already structured (a concurrent sync or a Chad-saved plan), reuse it.
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
  applyMutationReceipt(
    mutationReceipt({
      domain: "plans",
      entity: "planDays",
      op: "update",
      alsoDomains: ["training"],
      // Plan summaries render on /today (registry gap until FIX-28 registers
      // plan metrics).
      alsoSurfaces: ["/today"],
    })
  );
  return { ok: true, days };
}
