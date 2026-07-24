import type { ExerciseKind } from "@/lib/workouts/exercise-library";
import type { SetType, WeightUnit } from "@/lib/workouts/stats";

// ---------------------------------------------------------------------------
// Client-side model for the workout feature. Three concepts, kept strictly
// separate everywhere in the UI:
//
//   WORKOUT (template), a reusable PLAN the member builds ahead of time
//     ("Push Day": bench 3×8, rows 3×10 …). Stored in the WorkoutTemplate
//     table. Building one never touches history.
//   SESSION, the LIVE workout happening right now. Lives in this store
//     (mirrored to localStorage so a refresh never loses sets) until Finish,
//     which saves it to the database through the saveWorkout server action.
//   HISTORY, the permanent log (Workout/WorkoutExercise/WorkoutSet rows).
// ---------------------------------------------------------------------------

/** A pickable exercise: a built-in library entry or the member's own. */
export type ExerciseRef = {
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  kind: ExerciseKind;
  /** True when it comes from the member's CustomExercise table. */
  custom?: boolean;
};

export type PRKind = "heaviest-weight" | "best-est-1rm";

export type SessionSet = {
  id: string;
  type: SetType;
  /** Weight in the session's unit. For bodyweight moves this is ADDED weight. */
  weight: number | null;
  reps: number | null;
  /** Rate of perceived exertion (6–10), optional. */
  rpe: number | null;
  completed: boolean;
  /** Personal-record flags computed when the set is checked off. */
  prs?: PRKind[];
};

export type SessionExercise = {
  id: string;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  kind: ExerciseKind;
  restSeconds: number;
  note: string | null;
  /** The plan's prescription line ("3 x 8-12"), shown under the name. */
  targetLabel: string | null;
  sets: SessionSet[];
};

/**
 * The session clock. NOTHING starts it automatically, the member presses
 * Play. The FIRST Play press runs a short start countdown (5-4-3-2-1) before
 * the clock begins; Skip inside it begins immediately. Pause/Resume never
 * re-enters the countdown. Pause folds elapsed time into accumulatedMs;
 * Reset zeroes everything, back to the pre-start state.
 */
export type SessionTimer = {
  running: boolean;
  accumulatedMs: number;
  /** Epoch ms of the last Play press; null while paused. */
  startedAt: number | null;
  /** Epoch ms when the start countdown ends; null when none is running. Set
   * ONLY by the initial Play press, and never survives a reload (the store
   * strips it on hydrate), so a countdown can only ever run from a live Play
   * press. Optional: sessions persisted before S4 don't carry the field. */
  countdownEndsAt?: number | null;
};

/** Length of the start countdown the first Play press runs. */
export const START_COUNTDOWN_SECONDS = 5;

/** The prescribed plan session a live session was started from (FIX-28), so
 * saving records a PlanSessionCompletion event for adherence/Up next. */
export type PlanRef = {
  planId: string;
  planSessionId: string;
  sessionName: string;
};

export type ActiveSession = {
  id: string;
  name: string;
  /** The "My Workouts" template this session was started from, if any. */
  templateId: string | null;
  /** The plan session this was started from, if any (optional: sessions
   * persisted before FIX-28 simply have none). */
  planRef?: PlanRef | null;
  createdAt: number;
  timer: SessionTimer;
  unit: WeightUnit;
  notes: string;
  exercises: SessionExercise[];
};

/** Rest countdown. Starts ONLY when a set is checked off. */
export type RestTimer = {
  endsAt: number;
  totalSeconds: number;
  exerciseName: string;
};

/** One exercise row inside the template builder. */
export type DraftExercise = {
  id: string;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
  kind: ExerciseKind;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  restSeconds: number;
  note: string | null;
};

/** The template being built/edited, persisted so the picker page round-trip
 * (a real navigation) can never lose work. */
export type BuilderDraft = {
  /** Null while creating; the template id while editing. */
  templateId: string | null;
  name: string;
  exercises: DraftExercise[];
  /** JSON snapshot of the loaded state, for the unsaved-changes check. */
  baseline: string;
};

export const REST_OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 0, label: "No rest timer" },
  { seconds: 60, label: "1 min" },
  { seconds: 90, label: "1½ min" },
  { seconds: 120, label: "2 min" },
  { seconds: 150, label: "2½ min" },
  { seconds: 180, label: "3 min" },
  { seconds: 240, label: "4 min" },
  { seconds: 300, label: "5 min" },
];

export const SET_TYPE_META: Record<
  SetType,
  { tag: string; name: string; hint: string; tagClass: string }
> = {
  working: {
    tag: "",
    name: "Normal working set",
    hint: "Counts toward your totals and records",
    tagClass: "",
  },
  warmup: {
    tag: "W",
    name: "Warm-up set",
    hint: "Lighter prep set. Not counted in totals or records",
    tagClass: "text-amber-500 dark:text-amber-300",
  },
  dropset: {
    tag: "D",
    name: "Drop set",
    hint: "Lighter set done right after a heavy one",
    tagClass: "text-purple-500 dark:text-purple-300",
  },
  failure: {
    tag: "F",
    name: "Set to failure",
    hint: "You went until you couldn't do another rep",
    tagClass: "text-blood",
  },
};

export const RPE_OPTIONS: {
  value: number | null;
  label: string;
  hint: string;
}[] = [
  { value: null, label: "No RPE", hint: "Skip effort tracking for this set" },
  { value: 6, label: "RPE 6", hint: "Easy: 4+ reps left in the tank" },
  { value: 7, label: "RPE 7", hint: "Moderate: about 3 reps left" },
  { value: 8, label: "RPE 8", hint: "Hard: about 2 reps left" },
  { value: 9, label: "RPE 9", hint: "Very hard: 1 rep left" },
  { value: 10, label: "RPE 10", hint: "Max effort: nothing left" },
];
