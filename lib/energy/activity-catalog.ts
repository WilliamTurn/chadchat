/**
 * Calories-burned Phase 1: the vendored activity catalog, ~40 activities
 * with MET values from the 2024 Adult Compendium of Physical Activities
 * (pacompendium.com; values the plan's research table pins are used
 * verbatim, the rest are representative Compendium values rounded to one
 * decimal). Each activity carries everything a later "~X cal/min at your
 * weight" display needs: a default MET plus intensity variants that are
 * standalone METs, never multipliers (owner catalog-shape wish; display
 * itself is Phase 3+, nothing here renders).
 *
 * Energy math lives in lib/energy/workout-energy.ts (net METs, D3). This
 * module is data + lookup only.
 *
 * Labels are member-facing (Phase 3 picker): neutral product voice, plain
 * words, self-explanatory, no jargon.
 */

export type ActivityVariant = {
  /** Stable id, unique within the activity ("vigorous", "6-mph"). */
  id: string;
  label: string;
  /** Standalone MET for this intensity (not a modifier on the default). */
  met: number;
};

/** Picker sections (Phase 3): the catalog's own comment groups, made data. */
export const ACTIVITY_GROUPS = [
  { id: "gym-cardio", label: "Gym cardio" },
  { id: "outdoor", label: "Outdoor" },
  { id: "sports", label: "Sports" },
  { id: "strength-mind-body", label: "Strength and mind-body" },
  { id: "everyday", label: "Everyday" },
] as const;

export type ActivityGroupId = (typeof ACTIVITY_GROUPS)[number]["id"];

export type Activity = {
  /** Stable kebab-case id — stored on logged cardio entries from Phase 3. */
  id: string;
  label: string;
  /** Picker section this activity lists under. */
  group: ActivityGroupId;
  /** The default MET: the general / moderate effort. */
  met: number;
  /** Optional intensity choices; omit when one honest number covers it. */
  variants?: readonly ActivityVariant[];
};

export const ACTIVITY_CATALOG: readonly Activity[] = [
  /* ------------------------------------------------------- gym cardio */
  {
    id: "treadmill-run", group: "gym-cardio",
    label: "Treadmill run",
    met: 8.5,
    variants: [
      { id: "5-mph", label: "5 mph (12:00 mile)", met: 8.5 },
      { id: "6-mph", label: "6 mph (10:00 mile)", met: 9.3 },
      { id: "7-mph", label: "7 mph (8:30 mile)", met: 11.0 },
      { id: "8-mph", label: "8 mph (7:30 mile)", met: 11.8 },
      { id: "10-mph", label: "10 mph (6:00 mile)", met: 14.8 },
    ],
  },
  {
    id: "treadmill-walk", group: "gym-cardio",
    label: "Treadmill walk",
    met: 4.8,
    variants: [
      { id: "casual", label: "Casual (3 mph)", met: 3.5 },
      { id: "brisk", label: "Brisk (3.5 mph)", met: 4.8 },
      { id: "fast", label: "Fast (4 mph)", met: 5.0 },
    ],
  },
  {
    id: "rowing-machine", group: "gym-cardio",
    label: "Rowing machine",
    met: 7.5,
    variants: [
      { id: "easy", label: "Easy", met: 4.8 },
      { id: "moderate", label: "Moderate", met: 7.5 },
      { id: "vigorous", label: "Vigorous", met: 8.5 },
      { id: "all-out", label: "All-out intervals", met: 12.0 },
    ],
  },
  {
    id: "stationary-bike", group: "gym-cardio",
    label: "Stationary bike",
    met: 6.8,
    variants: [
      { id: "easy", label: "Easy", met: 4.8 },
      { id: "moderate", label: "Moderate", met: 6.8 },
      { id: "vigorous", label: "Vigorous", met: 8.8 },
    ],
  },
  {
    id: "elliptical", group: "gym-cardio",
    label: "Elliptical",
    met: 5.0,
    variants: [
      { id: "moderate", label: "Moderate", met: 5.0 },
      { id: "vigorous", label: "Vigorous", met: 6.0 },
    ],
  },
  { id: "stair-climber", group: "gym-cardio", label: "Stair climber", met: 9.0 },
  { id: "spin-class", group: "gym-cardio", label: "Spin class", met: 8.5 },
  {
    id: "jump-rope", group: "gym-cardio",
    label: "Jump rope",
    met: 11.0,
    variants: [
      { id: "slow", label: "Slow", met: 8.8 },
      { id: "moderate", label: "Moderate", met: 11.0 },
      { id: "fast", label: "Fast", met: 12.3 },
    ],
  },
  { id: "hiit", group: "gym-cardio", label: "HIIT workout", met: 11.0 },
  { id: "circuit-training", group: "gym-cardio", label: "Circuit training", met: 8.0 },

  /* ---------------------------------------------------------- outdoor */
  {
    id: "running", group: "outdoor",
    label: "Running",
    met: 8.5,
    variants: [
      { id: "5-mph", label: "5 mph (12:00 mile)", met: 8.5 },
      { id: "6-mph", label: "6 mph (10:00 mile)", met: 9.3 },
      { id: "7-mph", label: "7 mph (8:30 mile)", met: 11.0 },
      { id: "8-mph", label: "8 mph (7:30 mile)", met: 11.8 },
      { id: "10-mph", label: "10 mph (6:00 mile)", met: 14.8 },
    ],
  },
  { id: "trail-running", group: "outdoor", label: "Trail running", met: 9.0 },
  {
    id: "walking", group: "outdoor",
    label: "Walking",
    met: 3.5,
    variants: [
      { id: "casual", label: "Casual (2.5 mph)", met: 3.0 },
      { id: "moderate", label: "Moderate (3 mph)", met: 3.5 },
      { id: "brisk", label: "Brisk (3.5 mph)", met: 4.8 },
    ],
  },
  {
    id: "cycling", group: "outdoor",
    label: "Cycling",
    met: 8.0,
    variants: [
      { id: "leisure", label: "Leisure pace", met: 4.0 },
      { id: "moderate", label: "Moderate (12 to 14 mph)", met: 8.0 },
      { id: "vigorous", label: "Vigorous (14 to 16 mph)", met: 10.0 },
    ],
  },
  { id: "hiking", group: "outdoor", label: "Hiking", met: 5.3 },
  {
    id: "swimming", group: "outdoor",
    label: "Swimming laps",
    met: 8.0,
    variants: [
      { id: "easy", label: "Easy", met: 5.8 },
      { id: "moderate", label: "Moderate", met: 8.0 },
      { id: "vigorous", label: "Vigorous", met: 9.8 },
    ],
  },
  { id: "water-aerobics", group: "outdoor", label: "Water aerobics", met: 5.3 },
  { id: "rollerblading", group: "outdoor", label: "Rollerblading", met: 7.5 },
  { id: "ice-skating", group: "outdoor", label: "Ice skating", met: 7.0 },
  { id: "downhill-skiing", group: "outdoor", label: "Downhill skiing", met: 5.3 },
  { id: "cross-country-skiing", group: "outdoor", label: "Cross-country skiing", met: 9.0 },

  /* ----------------------------------------------------------- sports */
  { id: "basketball", group: "sports", label: "Basketball", met: 7.5 },
  {
    id: "soccer", group: "sports",
    label: "Soccer",
    met: 9.5,
    variants: [
      { id: "casual", label: "Casual", met: 7.0 },
      { id: "game", label: "Game", met: 9.5 },
    ],
  },
  { id: "tennis-singles", group: "sports", label: "Tennis (singles)", met: 8.0 },
  { id: "tennis-doubles", group: "sports", label: "Tennis (doubles)", met: 6.0 },
  { id: "pickleball", group: "sports", label: "Pickleball", met: 4.1 },
  { id: "badminton", group: "sports", label: "Badminton", met: 5.5 },
  {
    id: "volleyball", group: "sports",
    label: "Volleyball",
    met: 4.0,
    variants: [
      { id: "casual", label: "Casual", met: 4.0 },
      { id: "competitive", label: "Competitive", met: 6.0 },
      { id: "beach", label: "Beach", met: 8.0 },
    ],
  },
  { id: "golf-walking", group: "sports", label: "Golf (walking)", met: 4.3 },
  { id: "martial-arts", group: "sports", label: "Martial arts", met: 10.3 },
  {
    id: "boxing", group: "sports",
    label: "Boxing",
    met: 5.5,
    variants: [
      { id: "bag-work", label: "Bag work", met: 5.5 },
      { id: "sparring", label: "Sparring", met: 7.8 },
    ],
  },
  { id: "rock-climbing", group: "sports", label: "Rock climbing", met: 8.0 },
  {
    id: "dancing", group: "sports",
    label: "Dancing",
    met: 4.8,
    variants: [
      { id: "social", label: "Social", met: 4.8 },
      { id: "fitness-class", label: "Dance fitness class", met: 7.3 },
    ],
  },

  /* ------------------------------------------- strength and mind-body */
  {
    id: "weight-lifting", group: "strength-mind-body",
    label: "Weight lifting",
    met: 3.5,
    variants: [
      { id: "general", label: "General (8 to 15 reps)", met: 3.5 },
      { id: "compound", label: "Compound focus (squat, deadlift)", met: 5.0 },
      { id: "vigorous", label: "Vigorous", met: 6.0 },
    ],
  },
  {
    id: "calisthenics", group: "strength-mind-body",
    label: "Calisthenics",
    met: 3.8,
    variants: [
      { id: "moderate", label: "Moderate", met: 3.8 },
      { id: "vigorous", label: "Vigorous", met: 8.0 },
    ],
  },
  { id: "kettlebell", group: "strength-mind-body", label: "Kettlebell workout", met: 8.0 },
  {
    id: "yoga", group: "strength-mind-body",
    label: "Yoga",
    met: 2.3,
    variants: [
      { id: "gentle", label: "Gentle", met: 2.3 },
      { id: "power", label: "Power", met: 4.0 },
    ],
  },
  { id: "pilates", group: "strength-mind-body", label: "Pilates", met: 3.0 },
  { id: "stretching", group: "strength-mind-body", label: "Stretching and mobility", met: 2.3 },

  /* ----------------------------------------------------------- everyday */
  { id: "yard-work", group: "everyday", label: "Yard work", met: 4.0 },
  { id: "housework", group: "everyday", label: "Housework (vigorous)", met: 3.5 },
];

/**
 * The 4 machine-cardio names in lib/workouts/exercise-library.ts, mapped to
 * their catalog activities (plan §6). Keys are the library's exact
 * `LibraryExercise.name` values; lookup below is case-insensitive to match
 * findBuiltInExercise's convention.
 */
export const LIBRARY_CARDIO_ACTIVITY_IDS: Record<string, string> = {
  "Treadmill Run": "treadmill-run",
  "Rowing Machine": "rowing-machine",
  "Stationary Bike": "stationary-bike",
  "Stair Climber": "stair-climber",
};

export function findActivity(id: string): Activity | undefined {
  return ACTIVITY_CATALOG.find((a) => a.id === id);
}

/**
 * The MET for an activity (optionally at a named intensity variant).
 * Null when the activity or variant is unknown — callers surface missing
 * data instead of guessing.
 */
export function activityMet(
  activityId: string,
  variantId?: string
): number | null {
  const activity = findActivity(activityId);
  if (!activity) {
    return null;
  }
  if (variantId == null) {
    return activity.met;
  }
  const variant = activity.variants?.find((v) => v.id === variantId);
  return variant ? variant.met : null;
}

/** The catalog activity behind a built-in library exercise name
 * (case-insensitive), or undefined for non-cardio library rows. */
export function activityForLibraryExercise(
  name: string
): Activity | undefined {
  const entry = Object.entries(LIBRARY_CARDIO_ACTIVITY_IDS).find(
    ([libraryName]) => libraryName.toLowerCase() === name.toLowerCase()
  );
  return entry ? findActivity(entry[1]) : undefined;
}

/**
 * Separator between activity and effort in a logged cardio exercise name
 * ("Rowing machine · Vigorous"). The name is the snapshot workout rows
 * already store (exerciseName), so a logged session stays honest even if
 * the catalog changes later; metForExerciseName reads it back.
 */
export const CARDIO_NAME_SEPARATOR = " · ";

/**
 * The exercise-name snapshot the Phase 3 cardio logger stores: the activity
 * label, plus the chosen effort when one was picked. Null when the ids don't
 * name a real catalog entry (the action rejects, never guesses).
 */
export function cardioExerciseName(
  activityId: string,
  variantId?: string
): string | null {
  const activity = findActivity(activityId);
  if (!activity) {
    return null;
  }
  if (variantId == null) {
    return activity.label;
  }
  const variant = activity.variants?.find((v) => v.id === variantId);
  return variant
    ? `${activity.label}${CARDIO_NAME_SEPARATOR}${variant.label}`
    : null;
}

/**
 * The MET behind a logged exercise NAME: one of the 4 built-in machine-cardio
 * library names ("Treadmill Run"), a catalog label ("Hiking"), or a
 * variant-suffixed cardio-logger snapshot ("Treadmill run · 6 mph (10:00
 * mile)"). Case-insensitive, like every name lookup on workout rows. Null =
 * not a known cardio activity — callers treat the exercise as strength work
 * instead of guessing.
 */
export function metForExerciseName(name: string): number | null {
  const trimmed = name.trim();
  const library = activityForLibraryExercise(trimmed);
  if (library) {
    return library.met;
  }
  const lower = trimmed.toLowerCase();
  const byLabel = ACTIVITY_CATALOG.find((a) => a.label.toLowerCase() === lower);
  if (byLabel) {
    return byLabel.met;
  }
  const sep = trimmed.indexOf(CARDIO_NAME_SEPARATOR);
  if (sep === -1) {
    return null;
  }
  const activityLabel = trimmed.slice(0, sep).trim().toLowerCase();
  const variantLabel = trimmed
    .slice(sep + CARDIO_NAME_SEPARATOR.length)
    .trim()
    .toLowerCase();
  const activity = ACTIVITY_CATALOG.find(
    (a) => a.label.toLowerCase() === activityLabel
  );
  const variant = activity?.variants?.find(
    (v) => v.label.toLowerCase() === variantLabel
  );
  return variant ? variant.met : null;
}
