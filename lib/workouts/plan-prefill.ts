import type { PlanDay, PlanDayExercise } from "@/lib/validation/plan-days";
import { formatPlanTarget } from "@/lib/validation/plan-days";
import {
  exerciseKind,
  findBuiltInExercise,
} from "@/lib/workouts/exercise-library";
import type { LastExerciseLog } from "@/lib/workouts/stats";

type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: string;
  notes: string | null;
};

type GhostValue = { weight: string; reps: string };

export type PlanPrefillExercise = {
  name: string;
  muscleGroup: string | null;
  kind: "weighted" | "bodyweight" | "timed" | null;
  target: string;
  sets: number;
  unit: "lb" | "kg";
  ghosts: GhostValue[];
};

export type PlanPrefill = {
  title: string;
  exercises: PlanPrefillExercise[];
};

/** Ghost placeholders from a last-session lookup entry. */
function ghostsFromHistory(
  sets: LastExerciseLog["sets"]
): GhostValue[] {
  return sets.map((s) => ({
    weight: s.weight == null ? "" : String(s.weight),
    reps: s.reps == null ? "" : String(s.reps),
  }));
}

/**
 * Resolve a plan day into logger prefill: each exercise's logging kind and
 * muscle group come from the member's custom library or the built-in catalog;
 * ghosts come from their last logged session of that exercise, falling back
 * to the plan's own prescription when they've never done it. Pure, so it runs on
 * the server for /workouts/log?plan=… (FN-2's client version moved here for
 * the MOB-18 full-page logger).
 */
export function buildPlanPrefill(
  day: PlanDay,
  customExercises: CustomExerciseRow[],
  lastSets: Record<string, LastExerciseLog>
): PlanPrefill {
  return {
    title: day.name,
    exercises: day.exercises.map((ex) => {
      const key = ex.name.trim().toLowerCase();
      const custom = customExercises.find(
        (c) => c.name.trim().toLowerCase() === key
      );
      const builtIn = findBuiltInExercise(ex.name);
      const kind = custom
        ? exerciseKind(custom)
        : builtIn
          ? exerciseKind(builtIn)
          : "weighted";
      const muscleGroup = custom?.muscleGroup ?? builtIn?.muscleGroup ?? null;

      const history = lastSets[key];
      const ghosts = history
        ? ghostsFromHistory(history.sets)
        : [planGhost(ex, kind)];

      return {
        name: builtIn?.name ?? custom?.name ?? ex.name,
        muscleGroup,
        kind,
        target: formatPlanTarget(ex),
        sets: ex.sets,
        unit: ex.unit ?? "lb",
        ghosts,
      };
    }),
  };
}

/** The plan's own prescription as a ghost, for never-before-logged exercises. */
function planGhost(
  ex: PlanDayExercise,
  kind: "weighted" | "bodyweight" | "timed"
): GhostValue {
  // A timed prescription like "45s" ghosts as plain seconds.
  const reps =
    kind === "timed" ? ex.reps.replace(/s(ec(onds)?)?$/i, "").trim() : ex.reps;
  return {
    weight: ex.weight != null && ex.weight > 0 ? String(ex.weight) : "",
    reps,
  };
}
