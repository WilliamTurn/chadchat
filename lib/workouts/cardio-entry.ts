/**
 * Calories-burned Phase 4: THE cardio write shape. Extracted verbatim from
 * the Phase 3 /workouts/cardio action so Chad's logCardio tool and the page
 * write the exact same rows through one builder — one logged workout whose
 * timed cardio exercise holds the "activity · effort" name snapshot and
 * whose single completed set stores the seconds. No new storage; the burn
 * estimate is recomputed at read time from name + catalog + latest weigh-in
 * (plan §6). Pure: no DB, no auth, no Date.now().
 */

import {
  type Activity,
  type ActivityVariant,
  cardioExerciseName,
  findActivity,
} from "@/lib/energy/activity-catalog";

export type CardioEntry = {
  activityId: string;
  variantId?: string;
  minutes: number;
  performedAt: Date;
  /** The member's display unit (User.weightUnit) — stored on the set row. */
  weightUnit: "lb" | "kg";
};

export type CardioWorkoutWrite = {
  title: string;
  performedAt: Date;
  durationSeconds: number;
  notes: null;
  exercises: {
    name: string;
    muscleGroup: "cardio";
    kind: "timed";
    supersetGroup: null;
    notes: null;
    sets: {
      weight: null;
      reps: number;
      unit: "lb" | "kg";
      rpe: null;
      setType: "working";
      completed: true;
    }[];
  }[];
};

/**
 * Validated cardio entry → the createWorkout payload (minus userId). Null
 * when the ids don't name a real catalog entry — callers reject, never
 * guess.
 */
export function buildCardioWorkout(entry: CardioEntry): CardioWorkoutWrite | null {
  const activity = findActivity(entry.activityId);
  const exerciseName = cardioExerciseName(entry.activityId, entry.variantId);
  if (!(activity && exerciseName)) {
    return null;
  }
  const seconds = entry.minutes * 60;
  return {
    title: activity.label,
    performedAt: entry.performedAt,
    durationSeconds: seconds,
    notes: null,
    exercises: [
      {
        name: exerciseName,
        muscleGroup: "cardio",
        kind: "timed",
        supersetGroup: null,
        notes: null,
        sets: [
          {
            weight: null,
            // Timed convention: the set's reps column holds seconds.
            reps: seconds,
            unit: entry.weightUnit,
            rpe: null,
            setType: "working",
            completed: true,
          },
        ],
      },
    ],
  };
}

/**
 * Resolve a spoken effort ("vigorous", "All-out intervals") to the
 * activity's variant, matching id or label case-insensitively — chat input
 * is words, not ids. Returns the variant, null for no/unknown activity or
 * no match, and undefined when no intensity was given (use the default).
 */
export function resolveCardioVariant(
  activity: Activity | undefined,
  intensity: string | null | undefined
): ActivityVariant | null | undefined {
  if (intensity == null || intensity.trim().length === 0) {
    return undefined;
  }
  const wanted = intensity.trim().toLowerCase();
  return (
    activity?.variants?.find(
      (v) => v.id.toLowerCase() === wanted || v.label.toLowerCase() === wanted
    ) ?? null
  );
}
