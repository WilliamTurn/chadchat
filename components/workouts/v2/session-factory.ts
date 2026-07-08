// Builders that turn a template / plan day / past workout / picker selection
// into a live session, plus live PR detection and the finish-time payload.
// Pure module (no React) so it's unit-testable.

import type {
  PlanDay,
} from "@/lib/validation/plan-days";
import { formatPlanTarget } from "@/lib/validation/plan-days";
import type { SaveWorkoutInput } from "@/lib/validation/workouts";
import type { TemplateExercise } from "@/lib/validation/workout-templates";
import { exerciseKind } from "@/lib/workouts/exercise-library";
import type {
  ExerciseData,
  LastExerciseLog,
  PrBaseline,
  WeightUnit,
} from "@/lib/workouts/stats";
import { epley1RM, toLb } from "@/lib/workouts/stats";
import type {
  ActiveSession,
  ExerciseRef,
  PRKind,
  SessionExercise,
  SessionSet,
} from "./types";

function factoryUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function newTimer() {
  // The clock NEVER starts on its own, the member presses Play.
  return { running: false, accumulatedMs: 0, startedAt: null };
}

function ghostFor(
  lastSets: Record<string, LastExerciseLog>,
  name: string
): LastExerciseLog["sets"] {
  // Sets logged without any numbers can't prefill anything useful.
  return (lastSets[name.trim().toLowerCase()]?.sets ?? []).filter(
    (s) => s.weight != null || s.reps != null
  );
}

/** Default weight for a fresh set: bodyweight moves start at 0 ADDED weight. */
function defaultWeight(kind: string): number | null {
  return kind === "bodyweight" ? 0 : null;
}

/**
 * Build one live exercise with `count` working sets, each prefilled from the
 * member's last session of this exercise so an unchanged set is one tap.
 */
export function buildSessionExercise(input: {
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  kind: string | null | undefined;
  restSeconds: number;
  note?: string | null;
  targetLabel?: string | null;
  targetSets: number;
  prescribedWeight?: number | null;
  lastSets: Record<string, LastExerciseLog>;
}): SessionExercise {
  const kind = exerciseKind({ kind: input.kind });
  const prev = ghostFor(input.lastSets, input.name);
  const sets: SessionSet[] = [];
  for (let i = 0; i < input.targetSets; i++) {
    const p = prev[Math.min(i, prev.length - 1)];
    sets.push({
      id: factoryUid("set"),
      type: "working",
      weight:
        p?.weight ?? input.prescribedWeight ?? defaultWeight(kind),
      reps: p?.reps ?? null,
      rpe: null,
      completed: false,
    });
  }
  return {
    id: factoryUid("wex"),
    name: input.name,
    muscleGroup: input.muscleGroup,
    equipment: input.equipment,
    kind,
    restSeconds: input.restSeconds,
    note: input.note?.trim() ? input.note : null,
    targetLabel: input.targetLabel ?? null,
    sets,
  };
}

/** A live session from a "My Workouts" template. */
export function sessionFromTemplate(
  template: { id: string; name: string; exercises: TemplateExercise[] },
  lastSets: Record<string, LastExerciseLog>,
  unit: WeightUnit
): ActiveSession {
  return {
    id: factoryUid("session"),
    name: template.name,
    templateId: template.id,
    createdAt: Date.now(),
    timer: newTimer(),
    unit,
    notes: "",
    exercises: template.exercises.map((ex) =>
      buildSessionExercise({
        name: ex.name,
        muscleGroup: ex.muscleGroup ?? null,
        equipment: ex.equipment ?? null,
        kind: ex.kind,
        restSeconds: ex.restSeconds,
        note: ex.note,
        targetLabel: `${ex.targetSets} sets x ${
          ex.repRangeMin === ex.repRangeMax
            ? ex.repRangeMin
            : `${ex.repRangeMin}-${ex.repRangeMax}`
        } ${ex.kind === "timed" ? "sec" : "reps"}`,
        targetSets: ex.targetSets,
        lastSets,
      })
    ),
  };
}

/** A live session from one day of Chad's training plan. */
export function sessionFromPlanDay(
  day: PlanDay,
  resolve: (name: string) => {
    muscleGroup: string | null;
    equipment: string | null;
    kind: string | null;
  },
  lastSets: Record<string, LastExerciseLog>,
  unit: WeightUnit
): ActiveSession {
  return {
    id: factoryUid("session"),
    name: day.name,
    templateId: null,
    createdAt: Date.now(),
    timer: newTimer(),
    unit,
    notes: "",
    exercises: day.exercises.map((ex) => {
      const info = resolve(ex.name);
      return buildSessionExercise({
        name: ex.name,
        muscleGroup: info.muscleGroup,
        equipment: info.equipment,
        kind: info.kind,
        restSeconds: 120,
        note: ex.note,
        targetLabel: formatPlanTarget(ex),
        targetSets: ex.sets,
        prescribedWeight: ex.weight ?? null,
        lastSets,
      });
    }),
  };
}

/** A live session repeating a past workout's exercises (values re-ghosted). */
export function sessionFromPast(
  past: { title: string; exercises: ExerciseData[] },
  resolveEquipment: (name: string) => string | null,
  lastSets: Record<string, LastExerciseLog>,
  unit: WeightUnit
): ActiveSession {
  return {
    id: factoryUid("session"),
    name: past.title,
    templateId: null,
    createdAt: Date.now(),
    timer: newTimer(),
    unit,
    notes: "",
    exercises: past.exercises.map((ex) => {
      const working = ex.sets.filter(
        (s) => s.completed && s.setType !== "warmup"
      ).length;
      return buildSessionExercise({
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        equipment: resolveEquipment(ex.name),
        kind: ex.kind,
        restSeconds: 120,
        targetSets: Math.max(working, 1),
        lastSets,
      });
    }),
  };
}

/** An empty freestyle session. */
export function emptySession(unit: WeightUnit): ActiveSession {
  return {
    id: factoryUid("session"),
    name: "Freestyle Workout",
    templateId: null,
    createdAt: Date.now(),
    timer: newTimer(),
    unit,
    notes: "",
    exercises: [],
  };
}

/** A live exercise from a picker selection (3 prefilled working sets, or as
 * many as last time, capped at 5, the Strong/Hevy default). */
export function exerciseFromRef(
  ref: ExerciseRef,
  lastSets: Record<string, LastExerciseLog>
): SessionExercise {
  const prev = ghostFor(lastSets, ref.name);
  const count = Math.max(3, Math.min(prev.length || 3, 5));
  return buildSessionExercise({
    name: ref.name,
    muscleGroup: ref.muscleGroup,
    equipment: ref.equipment,
    kind: ref.kind,
    restSeconds: 120,
    targetSets: count,
    lastSets,
  });
}

/**
 * PR check for a set being checked off right now, against the baseline the
 * server computed from saved history (a live session competes with your past,
 * not with itself). No baseline -> first time is a baseline, not a "record".
 */
export function detectPRs(
  baseline: Record<string, PrBaseline>,
  exercise: SessionExercise,
  set: SessionSet,
  unit: WeightUnit
): PRKind[] {
  if (
    set.type === "warmup" ||
    exercise.kind === "timed" ||
    !set.weight ||
    !set.reps
  ) {
    return [];
  }
  const base = baseline[exercise.name.trim().toLowerCase()];
  if (!base || (base.bestWeightLb === 0 && base.bestE1RMLb === 0)) {
    return [];
  }
  const prs: PRKind[] = [];
  const weightLb = toLb(set.weight, unit);
  if (weightLb > base.bestWeightLb) {
    prs.push("heaviest-weight");
  }
  const e = epley1RM(set.weight, set.reps);
  if (e != null && toLb(e, unit) > base.bestE1RMLb) {
    prs.push("best-est-1rm");
  }
  return prs;
}

/**
 * The finish-time payload: only exercises with at least one completed set,
 * and only their completed sets, in the shape the saveWorkout action expects.
 * `performedAt` is the member's local calendar day when the session started.
 */
export function serializeSession(
  session: ActiveSession,
  durationSeconds: number
): SaveWorkoutInput | null {
  const exercises = session.exercises
    .map((ex) => ({ ex, done: ex.sets.filter((s) => s.completed) }))
    .filter(({ done }) => done.length > 0);
  if (exercises.length === 0) {
    return null;
  }
  const started = new Date(session.createdAt);
  const performedAt = `${started.getFullYear()}-${String(
    started.getMonth() + 1
  ).padStart(2, "0")}-${String(started.getDate()).padStart(2, "0")}`;
  return {
    title: session.name.trim() || "Workout",
    performedAt,
    durationSeconds: durationSeconds > 0 ? Math.round(durationSeconds) : null,
    notes: session.notes.trim() ? session.notes.trim() : null,
    exercises: exercises.map(({ ex, done }) => ({
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      kind: ex.kind,
      supersetGroup: null,
      notes: ex.note,
      sets: done.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        unit: session.unit,
        rpe: s.rpe,
        setType: s.type,
        completed: true,
      })),
    })),
  };
}
