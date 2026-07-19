/**
 * Calories-burned Phase 1: session energy — net kcal from a logged workout,
 * per plan §4.1 and the owner rulings:
 *
 *   net kcal = (MET − 1) × kg × hours          (D3: net METs, Cronometer's
 *                                               arithmetic — the baseline
 *                                               burn for that hour is never
 *                                               double-counted)
 *
 * Strength sessions use Workout.durationSeconds at MET 3.5 ("general
 * lifting", D5) or the intense variant; sets/reps/RPE are training data,
 * never calorie inputs (the industry-wide MFP position). Cardio uses
 * minutes against the vendored catalog. Missing inputs return null — this
 * module never guesses, and estimates are labeled estimated at display
 * time (the registry entries carry estimated: true).
 *
 * Pure math, no DB, no Date.now().
 */

import {
  activityMet,
  metForExerciseName,
} from "@/lib/energy/activity-catalog";

/**
 * D5: strength default MET 3.5 ("weight lifting, general", 2024 Compendium)
 * with an intense variant at 6.0 ("vigorous lifting / bodybuilding"). The
 * conservative 6.0 — not circuit training's 8.0 — keeps the estimate honest
 * for hard straight-set sessions; true minimal-rest circuits log through the
 * catalog's circuit-training activity (MET 8.0) on the cardio path.
 */
export const STRENGTH_METS = {
  general: 3.5,
  intense: 6.0,
} as const;

export type StrengthIntensity = keyof typeof STRENGTH_METS;

const isUsable = (n: number | null | undefined): n is number =>
  n != null && Number.isFinite(n) && n > 0;

/**
 * The core net-energy formula, rounded to whole kcal:
 * (MET − 1) × weightKg × hours. Null on missing/non-positive inputs.
 */
export function netKcal(
  met: number | null,
  weightKg: number | null,
  hours: number | null
): number | null {
  if (!(isUsable(met) && isUsable(weightKg) && isUsable(hours))) {
    return null;
  }
  return Math.round((met - 1) * weightKg * hours);
}

/**
 * Net kcal per minute at a given MET and body weight — the number a later
 * "~X cal/min at your weight" display divides from (owner catalog-shape
 * wish). Unrounded; display owns rounding. Null on missing inputs.
 */
export function netKcalPerMinute(
  met: number | null,
  weightKg: number | null
): number | null {
  if (!(isUsable(met) && isUsable(weightKg))) {
    return null;
  }
  return ((met - 1) * weightKg) / 60;
}

export type StrengthEnergyInput = {
  kind: "strength";
  /** Workout.durationSeconds (the in-app timer / typed-in length). */
  durationSeconds: number | null;
  /** D5 session variant; omitted = "general". */
  intensity?: StrengthIntensity;
  /** Body weight in kg from the latest weigh-in; null = no weigh-in yet. */
  weightKg: number | null;
};

export type CardioEnergyInput = {
  kind: "cardio";
  /** Catalog activity id (lib/energy/activity-catalog.ts). */
  activityId: string;
  /** Optional intensity variant id on that activity. */
  variantId?: string;
  /** Session length in minutes (the Phase 3 cardio entry field). */
  minutes: number | null;
  weightKg: number | null;
};

export type WorkoutEnergyInput = StrengthEnergyInput | CardioEnergyInput;

/** Net kcal for a strength session: durationSeconds at the D5 MET. */
export function strengthNetKcal(
  input: Omit<StrengthEnergyInput, "kind">
): number | null {
  if (!isUsable(input.durationSeconds)) {
    return null;
  }
  const met = STRENGTH_METS[input.intensity ?? "general"];
  return netKcal(met, input.weightKg, input.durationSeconds / 3600);
}

/** Net kcal for a cardio session: minutes at the catalog MET. */
export function cardioNetKcal(
  input: Omit<CardioEnergyInput, "kind">
): number | null {
  if (!isUsable(input.minutes)) {
    return null;
  }
  const met = activityMet(input.activityId, input.variantId);
  return netKcal(met, input.weightKg, input.minutes / 60);
}

/**
 * THE canonical session → net kcal computation (registry:
 * energy.workout.kcal). One symbol for both session shapes so every surface
 * that ever shows a per-workout estimate goes through the same math.
 */
export function workoutNetKcal(input: WorkoutEnergyInput): number | null {
  return input.kind === "strength"
    ? strengthNetKcal(input)
    : cardioNetKcal(input);
}

/**
 * THE canonical day total (registry: energy.exercise.kcalPerDay): the sum
 * of the day's computable session estimates. Sessions whose inputs are
 * missing (null) contribute nothing rather than inventing a number; a day
 * with no computable session at all is null (renders not-logged, never 0).
 */
export function exerciseKcalForDay(
  sessionKcals: ReadonlyArray<number | null>
): number | null {
  const computable = sessionKcals.filter((k): k is number => k != null);
  if (computable.length === 0) {
    return null;
  }
  return computable.reduce((sum, k) => sum + k, 0);
}

/* ------------------------------------------------- logged-session shape */

/** The slice of a logged workout row this module prices (structurally
 * satisfied by lib/workouts/stats.ts WorkoutData — no import cycle). */
export type LoggedSession = {
  /** Workout.durationSeconds; null = the member never timed the session. */
  durationSeconds: number | null;
  exercises: ReadonlyArray<{
    name: string;
    /** "timed" sets hold seconds in `reps`; anything else is strength work. */
    kind?: "weighted" | "bodyweight" | "timed" | null;
    sets: ReadonlyArray<{ reps: number | null; completed: boolean }>;
  }>;
};

/** Whether every exercise in a logged session is catalog cardio — the
 * display cue to drop lifting chrome (set counts, volume) from a session
 * that was a run, not a lift. */
export function isCardioOnlySession(session: LoggedSession): boolean {
  return (
    session.exercises.length > 0 &&
    session.exercises.every(
      (ex) => ex.kind === "timed" && metForExerciseName(ex.name) != null
    )
  );
}

/**
 * THE canonical estimate for one LOGGED workout row (registry:
 * energy.workout.kcal — what the Phase 3 burn lines render). Splits the
 * session into its honest components and prices each through netKcal:
 *
 * - Cardio: every timed exercise whose name the catalog knows
 *   (metForExerciseName — machine-cardio library names, catalog labels, and
 *   the cardio logger's "activity · effort" snapshots). Its completed set
 *   seconds are priced at that activity's MET.
 * - Strength: the REST of the session's durationSeconds (minus the cardio
 *   seconds, so a treadmill stretch inside a lifting session is never
 *   double-counted) at the D5 general MET — but only when the session has
 *   at least one non-cardio exercise; resting between rowing intervals is
 *   not lifting.
 *
 * Missing inputs contribute nothing; a session with no computable component
 * returns null (renders no line, never a guess).
 */
export function sessionNetKcal(
  session: LoggedSession,
  weightKg: number | null
): number | null {
  let total = 0;
  let computable = false;
  let cardioSeconds = 0;
  let hasStrengthExercise = false;

  for (const ex of session.exercises) {
    const met = ex.kind === "timed" ? metForExerciseName(ex.name) : null;
    if (met == null) {
      hasStrengthExercise = true;
      continue;
    }
    const seconds = ex.sets.reduce(
      (sum, set) =>
        sum + (set.completed && set.reps != null && set.reps > 0 ? set.reps : 0),
      0
    );
    if (seconds <= 0) {
      continue;
    }
    cardioSeconds += seconds;
    const part = netKcal(met, weightKg, seconds / 3600);
    if (part != null) {
      total += part;
      computable = true;
    }
  }

  if (hasStrengthExercise && isUsable(session.durationSeconds)) {
    const strengthSeconds = Math.max(0, session.durationSeconds - cardioSeconds);
    if (strengthSeconds > 0) {
      const part = netKcal(
        STRENGTH_METS.general,
        weightKg,
        strengthSeconds / 3600
      );
      if (part != null) {
        total += part;
        computable = true;
      }
    }
  }

  return computable ? total : null;
}
