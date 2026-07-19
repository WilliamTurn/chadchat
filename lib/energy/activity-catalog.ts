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

export type Activity = {
  /** Stable kebab-case id — stored on logged cardio entries from Phase 3. */
  id: string;
  label: string;
  /** The default MET: the general / moderate effort. */
  met: number;
  /** Optional intensity choices; omit when one honest number covers it. */
  variants?: readonly ActivityVariant[];
};

export const ACTIVITY_CATALOG: readonly Activity[] = [
  /* ------------------------------------------------------- gym cardio */
  {
    id: "treadmill-run",
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
    id: "treadmill-walk",
    label: "Treadmill walk",
    met: 4.8,
    variants: [
      { id: "casual", label: "Casual (3 mph)", met: 3.5 },
      { id: "brisk", label: "Brisk (3.5 mph)", met: 4.8 },
      { id: "fast", label: "Fast (4 mph)", met: 5.0 },
    ],
  },
  {
    id: "rowing-machine",
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
    id: "stationary-bike",
    label: "Stationary bike",
    met: 6.8,
    variants: [
      { id: "easy", label: "Easy", met: 4.8 },
      { id: "moderate", label: "Moderate", met: 6.8 },
      { id: "vigorous", label: "Vigorous", met: 8.8 },
    ],
  },
  {
    id: "elliptical",
    label: "Elliptical",
    met: 5.0,
    variants: [
      { id: "moderate", label: "Moderate", met: 5.0 },
      { id: "vigorous", label: "Vigorous", met: 6.0 },
    ],
  },
  { id: "stair-climber", label: "Stair climber", met: 9.0 },
  { id: "spin-class", label: "Spin class", met: 8.5 },
  {
    id: "jump-rope",
    label: "Jump rope",
    met: 11.0,
    variants: [
      { id: "slow", label: "Slow", met: 8.8 },
      { id: "moderate", label: "Moderate", met: 11.0 },
      { id: "fast", label: "Fast", met: 12.3 },
    ],
  },
  { id: "hiit", label: "HIIT workout", met: 11.0 },
  { id: "circuit-training", label: "Circuit training", met: 8.0 },

  /* ---------------------------------------------------------- outdoor */
  {
    id: "running",
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
  { id: "trail-running", label: "Trail running", met: 9.0 },
  {
    id: "walking",
    label: "Walking",
    met: 3.5,
    variants: [
      { id: "casual", label: "Casual (2.5 mph)", met: 3.0 },
      { id: "moderate", label: "Moderate (3 mph)", met: 3.5 },
      { id: "brisk", label: "Brisk (3.5 mph)", met: 4.8 },
    ],
  },
  {
    id: "cycling",
    label: "Cycling",
    met: 8.0,
    variants: [
      { id: "leisure", label: "Leisure pace", met: 4.0 },
      { id: "moderate", label: "Moderate (12 to 14 mph)", met: 8.0 },
      { id: "vigorous", label: "Vigorous (14 to 16 mph)", met: 10.0 },
    ],
  },
  { id: "hiking", label: "Hiking", met: 5.3 },
  {
    id: "swimming",
    label: "Swimming laps",
    met: 8.0,
    variants: [
      { id: "easy", label: "Easy", met: 5.8 },
      { id: "moderate", label: "Moderate", met: 8.0 },
      { id: "vigorous", label: "Vigorous", met: 9.8 },
    ],
  },
  { id: "water-aerobics", label: "Water aerobics", met: 5.3 },
  { id: "rollerblading", label: "Rollerblading", met: 7.5 },
  { id: "ice-skating", label: "Ice skating", met: 7.0 },
  { id: "downhill-skiing", label: "Downhill skiing", met: 5.3 },
  { id: "cross-country-skiing", label: "Cross-country skiing", met: 9.0 },

  /* ----------------------------------------------------------- sports */
  { id: "basketball", label: "Basketball", met: 7.5 },
  {
    id: "soccer",
    label: "Soccer",
    met: 9.5,
    variants: [
      { id: "casual", label: "Casual", met: 7.0 },
      { id: "game", label: "Game", met: 9.5 },
    ],
  },
  { id: "tennis-singles", label: "Tennis (singles)", met: 8.0 },
  { id: "tennis-doubles", label: "Tennis (doubles)", met: 6.0 },
  { id: "pickleball", label: "Pickleball", met: 4.1 },
  { id: "badminton", label: "Badminton", met: 5.5 },
  {
    id: "volleyball",
    label: "Volleyball",
    met: 4.0,
    variants: [
      { id: "casual", label: "Casual", met: 4.0 },
      { id: "competitive", label: "Competitive", met: 6.0 },
      { id: "beach", label: "Beach", met: 8.0 },
    ],
  },
  { id: "golf-walking", label: "Golf (walking)", met: 4.3 },
  { id: "martial-arts", label: "Martial arts", met: 10.3 },
  {
    id: "boxing",
    label: "Boxing",
    met: 5.5,
    variants: [
      { id: "bag-work", label: "Bag work", met: 5.5 },
      { id: "sparring", label: "Sparring", met: 7.8 },
    ],
  },
  { id: "rock-climbing", label: "Rock climbing", met: 8.0 },
  {
    id: "dancing",
    label: "Dancing",
    met: 4.8,
    variants: [
      { id: "social", label: "Social", met: 4.8 },
      { id: "fitness-class", label: "Dance fitness class", met: 7.3 },
    ],
  },

  /* ------------------------------------------- strength and mind-body */
  {
    id: "weight-lifting",
    label: "Weight lifting",
    met: 3.5,
    variants: [
      { id: "general", label: "General (8 to 15 reps)", met: 3.5 },
      { id: "compound", label: "Compound focus (squat, deadlift)", met: 5.0 },
      { id: "vigorous", label: "Vigorous", met: 6.0 },
    ],
  },
  {
    id: "calisthenics",
    label: "Calisthenics",
    met: 3.8,
    variants: [
      { id: "moderate", label: "Moderate", met: 3.8 },
      { id: "vigorous", label: "Vigorous", met: 8.0 },
    ],
  },
  { id: "kettlebell", label: "Kettlebell workout", met: 8.0 },
  {
    id: "yoga",
    label: "Yoga",
    met: 2.3,
    variants: [
      { id: "gentle", label: "Gentle", met: 2.3 },
      { id: "power", label: "Power", met: 4.0 },
    ],
  },
  { id: "pilates", label: "Pilates", met: 3.0 },
  { id: "stretching", label: "Stretching and mobility", met: 2.3 },

  /* ----------------------------------------------------------- everyday */
  { id: "yard-work", label: "Yard work", met: 4.0 },
  { id: "housework", label: "Housework (vigorous)", met: 3.5 },
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
