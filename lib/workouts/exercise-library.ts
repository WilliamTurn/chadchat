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

// One-line plain-language form cue per built-in, keyed by lowercased name, so
// the exercise detail page never shows a bare name with no explanation.
const EXERCISE_CUES: Record<string, string> = {
  "barbell bench press":
    "Lie on the bench, lower the bar to mid-chest, press up until your arms lock out.",
  "incline barbell bench press":
    "Same as the bench press, on a 30-45° incline bench to hit the upper chest.",
  "dumbbell bench press":
    "Press a dumbbell in each hand from chest level to straight arms.",
  "incline dumbbell press":
    "Dumbbell press on an incline bench; lower to the upper chest.",
  "dumbbell fly":
    "Lying down, open your arms wide with a slight elbow bend, then bring the dumbbells together above you.",
  "cable crossover":
    "Pull both cables together in a hugging arc, arms slightly bent.",
  "chest press machine":
    "Seated, press the handles forward until your arms are straight, return under control.",
  "pec deck":
    "Bring the pads together in front of you with slightly bent arms, squeeze the chest.",
  "push-up":
    "Body straight, lower your chest to the floor, press back up.",
  dips:
    "On parallel bars, lower until your elbows hit 90°, press back up. Lean forward for chest.",
  deadlift:
    "Flat back, bar against your shins, stand up tall by driving through your legs.",
  "barbell row":
    "Hinge forward, pull the bar to your lower ribs, lower under control.",
  "pendlay row":
    "Bar starts on the floor each rep; pull it explosively to your chest, set it back down.",
  "pull-up":
    "Hang from the bar, palms away, pull until your chin clears the bar.",
  "chin-up": "Like a pull-up but palms facing you; more biceps.",
  "lat pulldown":
    "Seated, pull the wide bar down to your collarbone, control it back up.",
  "seated cable row":
    "Seated, pull the handle to your stomach, squeeze your shoulder blades.",
  "dumbbell row":
    "One hand on the bench, pull the dumbbell to your hip, one side at a time.",
  "t-bar row": "Straddle the bar, pull the handles to your chest, lower slowly.",
  "face pull":
    "Pull the rope toward your face, elbows high, hands finishing by your ears.",
  "barbell back squat":
    "Bar on your upper back, sit down until your thighs pass parallel, stand up.",
  "front squat":
    "Bar on the front of your shoulders, elbows high, squat deep.",
  "romanian deadlift":
    "Soft knees, push your hips back, lower the bar down your legs, stand tall.",
  "leg press":
    "Push the sled away until your legs are nearly straight; don't lock out hard.",
  "leg extension":
    "Seated, straighten your knees against the pad, lower under control.",
  "leg curl":
    "Curl your heels toward your glutes against the pad, lower slowly.",
  "walking lunge":
    "Step forward, lower the back knee toward the floor, push up and step through.",
  "bulgarian split squat":
    "Rear foot on a bench, squat down on the front leg, drive back up.",
  "goblet squat":
    "Hold one dumbbell at your chest like a goblet, squat between your knees.",
  "calf raise":
    "Rise onto your toes as high as possible, lower your heels below the step.",
  "hip thrust":
    "Upper back on a bench, bar over your hips, drive your hips up and squeeze.",
  "glute bridge":
    "Lying down, feet flat, lift your hips until your body is a straight line.",
  "cable kickback":
    "Ankle strap on, kick one leg straight back, squeeze at the top.",
  "overhead press":
    "Standing, press the bar from your collarbone to straight overhead.",
  "seated dumbbell press":
    "Seated, press dumbbells from ear height to overhead.",
  "arnold press":
    "Start palms facing you, rotate them forward as you press the dumbbells overhead.",
  "lateral raise":
    "Raise light dumbbells out to your sides to shoulder height, slight elbow bend.",
  "rear delt fly":
    "Hinge forward, raise dumbbells out to the sides, squeeze the rear shoulders.",
  "front raise":
    "Raise a dumbbell straight in front of you to shoulder height, lower slowly.",
  "upright row":
    "Pull the bar straight up your body to chest height, elbows leading.",
  shrug:
    "Heavy dumbbells at your sides, shrug your shoulders straight up, hold, lower.",
  "barbell curl":
    "Elbows pinned to your sides, curl the bar to shoulder height, lower slowly.",
  "dumbbell curl":
    "Curl one dumbbell in each hand, palms up, no swinging.",
  "hammer curl":
    "Curl with palms facing each other, like swinging a hammer.",
  "preacher curl":
    "Arms on the angled pad, curl up without lifting your elbows.",
  "cable curl":
    "Curl the cable bar with constant tension, elbows fixed at your sides.",
  "tricep pushdown":
    "Elbows at your sides, push the bar down until your arms are straight.",
  "overhead tricep extension":
    "Hold one dumbbell overhead with both hands, lower it behind your head, extend.",
  "skull crusher":
    "Lying down, lower the bar to your forehead by bending your elbows, extend back up.",
  "close-grip bench press":
    "Bench press with hands shoulder-width; elbows stay close to your body.",
  plank:
    "Forearms down, body straight as a board. Log the seconds you hold it.",
  "hanging leg raise":
    "Hang from a bar, raise straight legs to hip height without swinging.",
  "cable crunch":
    "Kneeling, hold the rope by your head, crunch your ribs toward your hips.",
  "sit-up":
    "Lying down, knees bent, curl your torso up to your knees, lower slowly.",
  "russian twist":
    "Seated, lean back slightly, rotate side to side. Hold a weight to make it harder.",
  "ab wheel rollout":
    "Kneeling, roll the wheel forward as far as you can control, pull back.",
  "treadmill run": "Steady run. Log the seconds (or use one set per interval).",
  "rowing machine":
    "Drive with your legs, then lean back and pull the handle to your ribs. Log the seconds.",
  "stationary bike": "Steady ride. Log the seconds you pedal.",
  "stair climber": "Steady climb, upright posture. Log the seconds.",
  "kettlebell swing":
    "Hinge at the hips and snap them forward to swing the bell to chest height.",
  burpee:
    "Squat down, kick back to a push-up, jump your feet in, and jump up.",
};

/** The one-line form cue for an exercise name ("" when we don't have one). */
export function exerciseCue(name: string): string {
  return EXERCISE_CUES[name.trim().toLowerCase()] ?? "";
}

/** An exercise's logging kind, defaulting the common case to "weighted". */
export function exerciseKind(e: {
  kind?: ExerciseKind | string | null;
}): ExerciseKind {
  return e.kind === "bodyweight" || e.kind === "timed" ? e.kind : "weighted";
}
