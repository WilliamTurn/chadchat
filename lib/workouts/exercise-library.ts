/**
 * Built-in exercise catalog. A plain data module (no "use client" / "server-only")
 * so the picker (client) and PR/stat helpers (server) can both import it.
 *
 * Users can add their own via the CustomExercise table; the picker merges these
 * built-ins with the user's custom list. Identity for PRs/trends is the
 * exercise NAME (case-insensitive), so names here are canonical.
 */

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
  "glutes",
  "fullBody",
  "cardio",
  "other",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "bands",
  "other",
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

// How an exercise is logged — the Hevy/Strong "exercise type". Drives the
// logger's set row: weighted = load × reps, bodyweight = reps with optional
// added load (dips with a belt), timed = seconds per set (planks, cardio).
export const EXERCISE_KINDS = ["weighted", "bodyweight", "timed"] as const;

export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export const EXERCISE_KIND_LABELS: Record<ExerciseKind, string> = {
  weighted: "Weighted",
  bodyweight: "Bodyweight",
  timed: "Timed",
};

export const EXERCISE_KIND_HELP: Record<ExerciseKind, string> = {
  weighted: "Log weight and reps per set",
  bodyweight: "Log reps; added weight optional",
  timed: "Log seconds per set",
};

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  glutes: "Glutes",
  fullBody: "Full body",
  cardio: "Cardio",
  other: "Other",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  bands: "Bands",
  other: "Other",
};

export type LibraryExercise = {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  // Omitted = "weighted" (the common case); see exerciseKind().
  kind?: ExerciseKind;
};

// A solid table-stakes catalog covering the big lifts and common accessories,
// like the default library Hevy/Strong ship with.
export const BUILT_IN_EXERCISES: LibraryExercise[] = [
  // Chest
  { name: "Barbell Bench Press", muscleGroup: "chest", equipment: "barbell" },
  { name: "Incline Barbell Bench Press", muscleGroup: "chest", equipment: "barbell" },
  { name: "Dumbbell Bench Press", muscleGroup: "chest", equipment: "dumbbell" },
  { name: "Incline Dumbbell Press", muscleGroup: "chest", equipment: "dumbbell" },
  { name: "Dumbbell Fly", muscleGroup: "chest", equipment: "dumbbell" },
  { name: "Cable Crossover", muscleGroup: "chest", equipment: "cable" },
  { name: "Chest Press Machine", muscleGroup: "chest", equipment: "machine" },
  { name: "Pec Deck", muscleGroup: "chest", equipment: "machine" },
  { name: "Push-Up", muscleGroup: "chest", equipment: "bodyweight", kind: "bodyweight" },
  { name: "Dips", muscleGroup: "chest", equipment: "bodyweight", kind: "bodyweight" },

  // Back
  { name: "Deadlift", muscleGroup: "back", equipment: "barbell" },
  { name: "Barbell Row", muscleGroup: "back", equipment: "barbell" },
  { name: "Pendlay Row", muscleGroup: "back", equipment: "barbell" },
  { name: "Pull-Up", muscleGroup: "back", equipment: "bodyweight", kind: "bodyweight" },
  { name: "Chin-Up", muscleGroup: "back", equipment: "bodyweight", kind: "bodyweight" },
  { name: "Lat Pulldown", muscleGroup: "back", equipment: "cable" },
  { name: "Seated Cable Row", muscleGroup: "back", equipment: "cable" },
  { name: "Dumbbell Row", muscleGroup: "back", equipment: "dumbbell" },
  { name: "T-Bar Row", muscleGroup: "back", equipment: "machine" },
  { name: "Face Pull", muscleGroup: "back", equipment: "cable" },

  // Legs
  { name: "Barbell Back Squat", muscleGroup: "legs", equipment: "barbell" },
  { name: "Front Squat", muscleGroup: "legs", equipment: "barbell" },
  { name: "Romanian Deadlift", muscleGroup: "legs", equipment: "barbell" },
  { name: "Leg Press", muscleGroup: "legs", equipment: "machine" },
  { name: "Leg Extension", muscleGroup: "legs", equipment: "machine" },
  { name: "Leg Curl", muscleGroup: "legs", equipment: "machine" },
  { name: "Walking Lunge", muscleGroup: "legs", equipment: "dumbbell" },
  { name: "Bulgarian Split Squat", muscleGroup: "legs", equipment: "dumbbell" },
  { name: "Goblet Squat", muscleGroup: "legs", equipment: "dumbbell" },
  { name: "Calf Raise", muscleGroup: "legs", equipment: "machine" },

  // Glutes
  { name: "Hip Thrust", muscleGroup: "glutes", equipment: "barbell" },
  { name: "Glute Bridge", muscleGroup: "glutes", equipment: "bodyweight", kind: "bodyweight" },
  { name: "Cable Kickback", muscleGroup: "glutes", equipment: "cable" },

  // Shoulders
  { name: "Overhead Press", muscleGroup: "shoulders", equipment: "barbell" },
  { name: "Seated Dumbbell Press", muscleGroup: "shoulders", equipment: "dumbbell" },
  { name: "Arnold Press", muscleGroup: "shoulders", equipment: "dumbbell" },
  { name: "Lateral Raise", muscleGroup: "shoulders", equipment: "dumbbell" },
  { name: "Rear Delt Fly", muscleGroup: "shoulders", equipment: "dumbbell" },
  { name: "Front Raise", muscleGroup: "shoulders", equipment: "dumbbell" },
  { name: "Upright Row", muscleGroup: "shoulders", equipment: "barbell" },
  { name: "Shrug", muscleGroup: "shoulders", equipment: "dumbbell" },

  // Arms
  { name: "Barbell Curl", muscleGroup: "arms", equipment: "barbell" },
  { name: "Dumbbell Curl", muscleGroup: "arms", equipment: "dumbbell" },
  { name: "Hammer Curl", muscleGroup: "arms", equipment: "dumbbell" },
  { name: "Preacher Curl", muscleGroup: "arms", equipment: "machine" },
  { name: "Cable Curl", muscleGroup: "arms", equipment: "cable" },
  { name: "Tricep Pushdown", muscleGroup: "arms", equipment: "cable" },
  { name: "Overhead Tricep Extension", muscleGroup: "arms", equipment: "dumbbell" },
  { name: "Skull Crusher", muscleGroup: "arms", equipment: "barbell" },
  { name: "Close-Grip Bench Press", muscleGroup: "arms", equipment: "barbell" },

  // Core
  { name: "Plank", muscleGroup: "core", equipment: "bodyweight", kind: "timed" },
  { name: "Hanging Leg Raise", muscleGroup: "core", equipment: "bodyweight", kind: "bodyweight" },
  { name: "Cable Crunch", muscleGroup: "core", equipment: "cable" },
  { name: "Sit-Up", muscleGroup: "core", equipment: "bodyweight", kind: "bodyweight" },
  { name: "Russian Twist", muscleGroup: "core", equipment: "bodyweight", kind: "bodyweight" },
  { name: "Ab Wheel Rollout", muscleGroup: "core", equipment: "other", kind: "bodyweight" },

  // Cardio / conditioning
  { name: "Treadmill Run", muscleGroup: "cardio", equipment: "machine", kind: "timed" },
  { name: "Rowing Machine", muscleGroup: "cardio", equipment: "machine", kind: "timed" },
  { name: "Stationary Bike", muscleGroup: "cardio", equipment: "machine", kind: "timed" },
  { name: "Stair Climber", muscleGroup: "cardio", equipment: "machine", kind: "timed" },
  { name: "Kettlebell Swing", muscleGroup: "fullBody", equipment: "kettlebell" },
  { name: "Burpee", muscleGroup: "fullBody", equipment: "bodyweight", kind: "bodyweight" },
];

/** Look up a built-in exercise by (case-insensitive) name. */
export function findBuiltInExercise(name: string): LibraryExercise | undefined {
  const key = name.trim().toLowerCase();
  return BUILT_IN_EXERCISES.find((e) => e.name.toLowerCase() === key);
}

/** An exercise's logging kind, defaulting the common case to "weighted". */
export function exerciseKind(e: {
  kind?: ExerciseKind | string | null;
}): ExerciseKind {
  return e.kind === "bodyweight" || e.kind === "timed" ? e.kind : "weighted";
}
