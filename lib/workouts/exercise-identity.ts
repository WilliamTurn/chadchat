/**
 * Canonical exercise identity (FIX-34). A plain data/logic module (no DB, no
 * React) that resolves any logged exercise name to ONE canonical identity so
 * records and PRs stop splitting across spelling variants ("Bench Press" vs
 * "Barbell Bench Press").
 *
 * Design (benchmark teardown in evidence-p34e/rule8-teardown-exercise-identity.md):
 * - Hevy's lesson: identity is a stable handle, the display name is a label.
 *   Built-ins get a stable `canonicalSlug`; plans and analytics reference the
 *   canonical name/slug, never the raw logged string.
 * - Strong's lesson (inverted): merges must be PREVIEWED and reversible.
 *   Resolution happens at read time when stats group exercises; logged
 *   WorkoutExercise rows are never rewritten, so any merge can be undone by
 *   removing the alias.
 * - Safety invariants (unit-tested in tests/unit/exercise-identity.test.ts):
 *   a built-in never resolves to another built-in, an alias key never collides
 *   with a built-in name, a name matching one of the member's OWN custom
 *   exercises is never folded, and unknown names always resolve to themselves.
 *
 * OWNER GATE: the curated merge was approved by the owner in-session
 * 2026-07-13 (recorded in the FIX-34 tracker row + the P3/P4 wave log).
 * Consumers (stats surfaces, FIX-33) adopt resolution in P5; nothing in the
 * live app resolves through this module yet.
 */

import type { WorkoutData } from "@/lib/workouts/stats";
import { BUILT_IN_EXERCISES } from "./exercise-library";

/**
 * Normalize a name into its identity KEY: unicode-normalized, lowercased,
 * apostrophes/periods dropped, hyphens/underscores/slashes/parentheses folded
 * to spaces, whitespace collapsed. "Push-Up", "push up" and "PUSH  UP" share
 * one key; "Bench Press (Barbell)" keys as "bench press barbell" so
 * Hevy-style names can be aliased.
 */
export function normalizeExerciseKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/\./g, "")
    .replace(/[-_/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable URL/reference slug for a canonical exercise name. */
export function canonicalSlug(name: string): string {
  return normalizeExerciseKey(name).replace(/ /g, "-");
}

export type AliasConfidence = "high" | "medium";

type CuratedAlias = {
  /** Raw alias; matched via normalizeExerciseKey. */
  alias: string;
  /** Must be an exact BUILT_IN_EXERCISES name (unit-tested). */
  canonical: string;
  /**
   * high = unambiguous spelling/shorthand of exactly this exercise.
   * medium = the standard default reading of a bare shorthand ("squat" =
   * barbell back squat). Equipment-ambiguous names ("shoulder press",
   * "chest fly", "tricep extension") are deliberately ABSENT.
   */
  confidence: AliasConfidence;
};

// Conservative curated merges. Every canonical target is a built-in; aliases
// never fold across equipment (no "barbell shrug" into the dumbbell Shrug).
export const CURATED_ALIASES: CuratedAlias[] = [
  // Chest
  { alias: "bench press", canonical: "Barbell Bench Press", confidence: "high" },
  { alias: "flat bench press", canonical: "Barbell Bench Press", confidence: "high" },
  { alias: "flat barbell bench press", canonical: "Barbell Bench Press", confidence: "high" },
  { alias: "barbell bench", canonical: "Barbell Bench Press", confidence: "high" },
  { alias: "bb bench press", canonical: "Barbell Bench Press", confidence: "high" },
  { alias: "bench press (barbell)", canonical: "Barbell Bench Press", confidence: "high" },
  { alias: "bench", canonical: "Barbell Bench Press", confidence: "medium" },
  { alias: "incline bench press", canonical: "Incline Barbell Bench Press", confidence: "high" },
  { alias: "incline bench", canonical: "Incline Barbell Bench Press", confidence: "medium" },
  { alias: "incline barbell press", canonical: "Incline Barbell Bench Press", confidence: "high" },
  { alias: "db bench press", canonical: "Dumbbell Bench Press", confidence: "high" },
  { alias: "dumbbell bench", canonical: "Dumbbell Bench Press", confidence: "high" },
  { alias: "flat dumbbell bench press", canonical: "Dumbbell Bench Press", confidence: "high" },
  { alias: "bench press (dumbbell)", canonical: "Dumbbell Bench Press", confidence: "high" },
  { alias: "incline db press", canonical: "Incline Dumbbell Press", confidence: "high" },
  { alias: "incline dumbbell bench press", canonical: "Incline Dumbbell Press", confidence: "high" },
  { alias: "dumbbell flye", canonical: "Dumbbell Fly", confidence: "high" },
  { alias: "db fly", canonical: "Dumbbell Fly", confidence: "high" },
  { alias: "db flye", canonical: "Dumbbell Fly", confidence: "high" },
  { alias: "cable fly", canonical: "Cable Crossover", confidence: "medium" },
  { alias: "cable flye", canonical: "Cable Crossover", confidence: "medium" },
  { alias: "pushup", canonical: "Push-Up", confidence: "high" },
  { alias: "pushups", canonical: "Push-Up", confidence: "high" },
  { alias: "push ups", canonical: "Push-Up", confidence: "high" },
  { alias: "press up", canonical: "Push-Up", confidence: "high" },
  { alias: "dip", canonical: "Dips", confidence: "high" },
  { alias: "chest dips", canonical: "Dips", confidence: "high" },
  { alias: "parallel bar dips", canonical: "Dips", confidence: "high" },
  { alias: "machine chest press", canonical: "Chest Press Machine", confidence: "high" },
  { alias: "seated chest press", canonical: "Chest Press Machine", confidence: "high" },
  { alias: "pec fly machine", canonical: "Pec Deck", confidence: "high" },
  { alias: "butterfly machine", canonical: "Pec Deck", confidence: "high" },
  { alias: "machine fly", canonical: "Pec Deck", confidence: "medium" },

  // Back
  { alias: "conventional deadlift", canonical: "Deadlift", confidence: "high" },
  { alias: "barbell deadlift", canonical: "Deadlift", confidence: "high" },
  { alias: "deadlift (barbell)", canonical: "Deadlift", confidence: "high" },
  { alias: "bent over row", canonical: "Barbell Row", confidence: "high" },
  { alias: "barbell bent over row", canonical: "Barbell Row", confidence: "high" },
  { alias: "bb row", canonical: "Barbell Row", confidence: "high" },
  { alias: "bent over row (barbell)", canonical: "Barbell Row", confidence: "high" },
  { alias: "pullup", canonical: "Pull-Up", confidence: "high" },
  { alias: "pullups", canonical: "Pull-Up", confidence: "high" },
  { alias: "pull ups", canonical: "Pull-Up", confidence: "high" },
  { alias: "chinup", canonical: "Chin-Up", confidence: "high" },
  { alias: "chinups", canonical: "Chin-Up", confidence: "high" },
  { alias: "chin ups", canonical: "Chin-Up", confidence: "high" },
  { alias: "lat pull down", canonical: "Lat Pulldown", confidence: "high" },
  { alias: "pulldown", canonical: "Lat Pulldown", confidence: "medium" },
  { alias: "pulldowns", canonical: "Lat Pulldown", confidence: "medium" },
  { alias: "cable pulldown", canonical: "Lat Pulldown", confidence: "high" },
  { alias: "lat pulldown (cable)", canonical: "Lat Pulldown", confidence: "high" },
  { alias: "cable row", canonical: "Seated Cable Row", confidence: "high" },
  { alias: "seated row", canonical: "Seated Cable Row", confidence: "medium" },
  { alias: "seated row (cable)", canonical: "Seated Cable Row", confidence: "high" },
  { alias: "single arm dumbbell row", canonical: "Dumbbell Row", confidence: "high" },
  { alias: "one arm dumbbell row", canonical: "Dumbbell Row", confidence: "high" },
  { alias: "db row", canonical: "Dumbbell Row", confidence: "high" },
  { alias: "face pulls", canonical: "Face Pull", confidence: "high" },
  { alias: "cable face pull", canonical: "Face Pull", confidence: "high" },

  // Legs
  { alias: "squat", canonical: "Barbell Back Squat", confidence: "medium" },
  { alias: "back squat", canonical: "Barbell Back Squat", confidence: "high" },
  { alias: "barbell squat", canonical: "Barbell Back Squat", confidence: "high" },
  { alias: "squat (barbell)", canonical: "Barbell Back Squat", confidence: "high" },
  { alias: "high bar squat", canonical: "Barbell Back Squat", confidence: "high" },
  { alias: "low bar squat", canonical: "Barbell Back Squat", confidence: "high" },
  { alias: "barbell front squat", canonical: "Front Squat", confidence: "high" },
  { alias: "front squat (barbell)", canonical: "Front Squat", confidence: "high" },
  { alias: "rdl", canonical: "Romanian Deadlift", confidence: "high" },
  { alias: "romanian dl", canonical: "Romanian Deadlift", confidence: "high" },
  { alias: "romanian deadlift (barbell)", canonical: "Romanian Deadlift", confidence: "high" },
  { alias: "leg press machine", canonical: "Leg Press", confidence: "high" },
  { alias: "leg extensions", canonical: "Leg Extension", confidence: "high" },
  { alias: "leg curls", canonical: "Leg Curl", confidence: "high" },
  { alias: "lying leg curl", canonical: "Leg Curl", confidence: "high" },
  { alias: "seated leg curl", canonical: "Leg Curl", confidence: "medium" },
  { alias: "hamstring curl", canonical: "Leg Curl", confidence: "high" },
  { alias: "lunges", canonical: "Walking Lunge", confidence: "medium" },
  { alias: "walking lunges", canonical: "Walking Lunge", confidence: "high" },
  { alias: "dumbbell walking lunge", canonical: "Walking Lunge", confidence: "high" },
  { alias: "bulgarian split squats", canonical: "Bulgarian Split Squat", confidence: "high" },
  { alias: "rear foot elevated split squat", canonical: "Bulgarian Split Squat", confidence: "high" },
  { alias: "goblet squats", canonical: "Goblet Squat", confidence: "high" },
  { alias: "calf raises", canonical: "Calf Raise", confidence: "high" },
  { alias: "standing calf raise", canonical: "Calf Raise", confidence: "medium" },

  // Glutes
  { alias: "barbell hip thrust", canonical: "Hip Thrust", confidence: "high" },
  { alias: "hip thrusts", canonical: "Hip Thrust", confidence: "high" },
  { alias: "hip thrust (barbell)", canonical: "Hip Thrust", confidence: "high" },
  { alias: "glute bridges", canonical: "Glute Bridge", confidence: "high" },

  // Shoulders
  { alias: "ohp", canonical: "Overhead Press", confidence: "high" },
  { alias: "military press", canonical: "Overhead Press", confidence: "high" },
  { alias: "barbell overhead press", canonical: "Overhead Press", confidence: "high" },
  { alias: "standing overhead press", canonical: "Overhead Press", confidence: "high" },
  { alias: "standing barbell press", canonical: "Overhead Press", confidence: "high" },
  { alias: "barbell shoulder press", canonical: "Overhead Press", confidence: "high" },
  { alias: "shoulder press (barbell)", canonical: "Overhead Press", confidence: "high" },
  { alias: "overhead press (barbell)", canonical: "Overhead Press", confidence: "high" },
  { alias: "strict press", canonical: "Overhead Press", confidence: "high" },
  { alias: "dumbbell shoulder press", canonical: "Seated Dumbbell Press", confidence: "medium" },
  { alias: "seated db press", canonical: "Seated Dumbbell Press", confidence: "high" },
  { alias: "seated dumbbell shoulder press", canonical: "Seated Dumbbell Press", confidence: "high" },
  { alias: "shoulder press (dumbbell)", canonical: "Seated Dumbbell Press", confidence: "medium" },
  { alias: "arnold presses", canonical: "Arnold Press", confidence: "high" },
  { alias: "lateral raises", canonical: "Lateral Raise", confidence: "high" },
  { alias: "side lateral raise", canonical: "Lateral Raise", confidence: "high" },
  { alias: "side raise", canonical: "Lateral Raise", confidence: "medium" },
  { alias: "db lateral raise", canonical: "Lateral Raise", confidence: "high" },
  { alias: "dumbbell lateral raise", canonical: "Lateral Raise", confidence: "high" },
  { alias: "lateral raise (dumbbell)", canonical: "Lateral Raise", confidence: "high" },
  { alias: "rear delt flye", canonical: "Rear Delt Fly", confidence: "high" },
  { alias: "reverse fly", canonical: "Rear Delt Fly", confidence: "medium" },
  { alias: "rear delt raise", canonical: "Rear Delt Fly", confidence: "medium" },
  { alias: "front raises", canonical: "Front Raise", confidence: "high" },
  { alias: "dumbbell front raise", canonical: "Front Raise", confidence: "high" },
  { alias: "upright rows", canonical: "Upright Row", confidence: "high" },
  { alias: "barbell upright row", canonical: "Upright Row", confidence: "high" },
  { alias: "shrugs", canonical: "Shrug", confidence: "high" },
  { alias: "dumbbell shrug", canonical: "Shrug", confidence: "high" },
  { alias: "dumbbell shrugs", canonical: "Shrug", confidence: "high" },
  { alias: "shrug (dumbbell)", canonical: "Shrug", confidence: "high" },

  // Arms
  { alias: "barbell curls", canonical: "Barbell Curl", confidence: "high" },
  { alias: "bb curl", canonical: "Barbell Curl", confidence: "high" },
  { alias: "barbell bicep curl", canonical: "Barbell Curl", confidence: "high" },
  { alias: "curl (barbell)", canonical: "Barbell Curl", confidence: "high" },
  { alias: "dumbbell curls", canonical: "Dumbbell Curl", confidence: "high" },
  { alias: "db curl", canonical: "Dumbbell Curl", confidence: "high" },
  { alias: "dumbbell bicep curl", canonical: "Dumbbell Curl", confidence: "high" },
  { alias: "bicep curl", canonical: "Dumbbell Curl", confidence: "medium" },
  { alias: "biceps curl", canonical: "Dumbbell Curl", confidence: "medium" },
  { alias: "curl (dumbbell)", canonical: "Dumbbell Curl", confidence: "high" },
  { alias: "hammer curls", canonical: "Hammer Curl", confidence: "high" },
  { alias: "db hammer curl", canonical: "Hammer Curl", confidence: "high" },
  { alias: "preacher curls", canonical: "Preacher Curl", confidence: "high" },
  { alias: "cable curls", canonical: "Cable Curl", confidence: "high" },
  { alias: "cable bicep curl", canonical: "Cable Curl", confidence: "high" },
  { alias: "triceps pushdown", canonical: "Tricep Pushdown", confidence: "high" },
  { alias: "cable pushdown", canonical: "Tricep Pushdown", confidence: "high" },
  { alias: "rope pushdown", canonical: "Tricep Pushdown", confidence: "high" },
  { alias: "tricep push down", canonical: "Tricep Pushdown", confidence: "high" },
  { alias: "cable tricep pushdown", canonical: "Tricep Pushdown", confidence: "high" },
  { alias: "overhead triceps extension", canonical: "Overhead Tricep Extension", confidence: "high" },
  { alias: "overhead dumbbell tricep extension", canonical: "Overhead Tricep Extension", confidence: "high" },
  { alias: "skull crushers", canonical: "Skull Crusher", confidence: "high" },
  { alias: "skullcrusher", canonical: "Skull Crusher", confidence: "high" },
  { alias: "skullcrushers", canonical: "Skull Crusher", confidence: "high" },
  { alias: "lying tricep extension", canonical: "Skull Crusher", confidence: "high" },
  { alias: "lying triceps extension", canonical: "Skull Crusher", confidence: "high" },
  { alias: "close grip bench", canonical: "Close-Grip Bench Press", confidence: "high" },
  { alias: "cgbp", canonical: "Close-Grip Bench Press", confidence: "high" },

  // Core
  { alias: "planks", canonical: "Plank", confidence: "high" },
  { alias: "front plank", canonical: "Plank", confidence: "high" },
  { alias: "forearm plank", canonical: "Plank", confidence: "high" },
  { alias: "hanging leg raises", canonical: "Hanging Leg Raise", confidence: "high" },
  { alias: "cable crunches", canonical: "Cable Crunch", confidence: "high" },
  { alias: "kneeling cable crunch", canonical: "Cable Crunch", confidence: "high" },
  { alias: "situp", canonical: "Sit-Up", confidence: "high" },
  { alias: "situps", canonical: "Sit-Up", confidence: "high" },
  { alias: "sit ups", canonical: "Sit-Up", confidence: "high" },
  { alias: "russian twists", canonical: "Russian Twist", confidence: "high" },
  { alias: "ab rollout", canonical: "Ab Wheel Rollout", confidence: "high" },
  { alias: "ab wheel", canonical: "Ab Wheel Rollout", confidence: "high" },
  { alias: "ab wheel rollouts", canonical: "Ab Wheel Rollout", confidence: "high" },

  // Cardio / conditioning
  { alias: "treadmill running", canonical: "Treadmill Run", confidence: "high" },
  { alias: "running treadmill", canonical: "Treadmill Run", confidence: "high" },
  { alias: "rowing", canonical: "Rowing Machine", confidence: "medium" },
  { alias: "rower", canonical: "Rowing Machine", confidence: "high" },
  { alias: "exercise bike", canonical: "Stationary Bike", confidence: "high" },
  { alias: "spin bike", canonical: "Stationary Bike", confidence: "high" },
  { alias: "stairmaster", canonical: "Stair Climber", confidence: "high" },
  { alias: "stair master", canonical: "Stair Climber", confidence: "high" },
  { alias: "kettlebell swings", canonical: "Kettlebell Swing", confidence: "high" },
  { alias: "kb swing", canonical: "Kettlebell Swing", confidence: "high" },
  { alias: "kettlebell swing (kettlebell)", canonical: "Kettlebell Swing", confidence: "high" },
  { alias: "russian kettlebell swing", canonical: "Kettlebell Swing", confidence: "high" },
  { alias: "burpees", canonical: "Burpee", confidence: "high" },
];

const BUILT_IN_BY_KEY: Map<string, string> = new Map(
  BUILT_IN_EXERCISES.map((e) => [normalizeExerciseKey(e.name), e.name])
);

const CURATED_BY_KEY: Map<string, CuratedAlias> = new Map(
  CURATED_ALIASES.map((a) => [normalizeExerciseKey(a.alias), a])
);

export type ExerciseResolution = {
  /** The display name records should group under. */
  canonicalName: string;
  /** normalizeExerciseKey(canonicalName); the grouping key. */
  canonicalKey: string;
  /** Stable reference handle (canonicalSlug of the canonical name). */
  slug: string;
  matchedVia:
    | "built-in"
    | "member-custom"
    | "member-alias"
    | "curated-alias"
    | "unmatched";
  /** Present only on curated-alias matches. */
  confidence?: AliasConfidence;
};

export type ResolveOptions = {
  /**
   * The member's own CustomExercise names. A logged name matching one of
   * these is a deliberate distinct entity and is NEVER alias-folded
   * (the picker's customs-win convention, and the FIX-34 safety line).
   */
  memberCustomNames?: string[];
  /**
   * Approved member-scoped aliases (normalized alias key -> canonical name),
   * from the ExerciseAlias table. Checked before the curated set.
   */
  memberAliases?: Map<string, string>;
};

function selfResolution(
  name: string,
  matchedVia: ExerciseResolution["matchedVia"]
): ExerciseResolution {
  const display = name.trim();
  return {
    canonicalName: display,
    canonicalKey: normalizeExerciseKey(display),
    slug: canonicalSlug(display),
    matchedVia,
  };
}

/**
 * Resolve a logged exercise name to its canonical identity. Precedence:
 * member custom (never folded) > built-in (never remapped) > approved member
 * alias > curated alias > itself. Total: every input resolves; unknown names
 * are their own identity, so unrelated exercises can never be affected.
 */
export function resolveExerciseIdentity(
  name: string,
  opts: ResolveOptions = {}
): ExerciseResolution {
  const key = normalizeExerciseKey(name);
  if (!key) {
    return selfResolution(name, "unmatched");
  }
  if (opts.memberCustomNames?.some((c) => normalizeExerciseKey(c) === key)) {
    return selfResolution(name, "member-custom");
  }
  const builtIn = BUILT_IN_BY_KEY.get(key);
  if (builtIn) {
    return {
      canonicalName: builtIn,
      canonicalKey: key,
      slug: canonicalSlug(builtIn),
      matchedVia: "built-in",
    };
  }
  const memberTarget = opts.memberAliases?.get(key);
  if (memberTarget) {
    return {
      canonicalName: memberTarget,
      canonicalKey: normalizeExerciseKey(memberTarget),
      slug: canonicalSlug(memberTarget),
      matchedVia: "member-alias",
    };
  }
  const curated = CURATED_BY_KEY.get(key);
  if (curated) {
    return {
      canonicalName: curated.canonical,
      canonicalKey: normalizeExerciseKey(curated.canonical),
      slug: canonicalSlug(curated.canonical),
      matchedVia: "curated-alias",
      confidence: curated.confidence,
    };
  }
  return selfResolution(name, "unmatched");
}

/**
 * Canonicalized COPIES of the given workouts: every exercise renamed to its
 * canonical identity so the name-keyed stats functions (computePersonalRecords,
 * exercise1RMTrend, prBaselineByExercise, ...) group variants together. Pure;
 * the inputs are untouched; this is resolution at read time, never a rewrite.
 */
export function canonicalizeWorkouts(
  workouts: WorkoutData[],
  opts: ResolveOptions = {}
): WorkoutData[] {
  return workouts.map((w) => ({
    ...w,
    exercises: w.exercises.map((ex) => ({
      ...ex,
      name: resolveExerciseIdentity(ex.name, opts).canonicalName,
    })),
  }));
}
