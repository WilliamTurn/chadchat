/**
 * The full-page workout logger's editor model (MOB-18): the in-progress
 * session's state shape plus every pure helper that manipulates or measures
 * it. Extracted from the retired dialog builder (workout-builder.tsx) so the
 * page component stays readable. No React imports; everything here is plain
 * data + math, unit-testable and shared with the finish summary.
 */

import type {
  ExerciseKindData,
  GhostSet,
  LastExerciseLog,
  PrBaseline,
  SetType,
  WorkoutData,
} from "@/lib/workouts/stats";
import { epley1RM, toLb } from "@/lib/workouts/stats";
import { formatCalendarDay } from "@/lib/date";

export type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: string;
  notes: string | null;
};

export type EditorSet = {
  uid: string;
  weight: string;
  reps: string;
  unit: "lb" | "kg";
  rpe: string;
  setType: SetType;
  completed: boolean;
};

// A prior/prescribed value shown as a placeholder in an empty set input (the
// Hevy "previous" column). Strings, because a plan target can be a range
// ("4-6") that can't be adopted as a number; only numeric ghosts auto-fill
// when the set is checked off.
export type GhostValue = { weight: string; reps: string };

export type EditorExercise = {
  uid: string;
  name: string;
  muscleGroup: string | null;
  kind: ExerciseKindData | null;
  // One-line plan prescription ("4 x 4-6 @ 185 lb · RPE 8"), plan mode only.
  target?: string | null;
  // Per-set-index placeholder values; the last one repeats for extra sets.
  ghosts?: GhostValue[];
  // Supersets (FEAT-10) are edited as a link to the exercise above; group
  // numbers are derived from the resulting chains on render and save.
  linkedWithPrev: boolean;
  notes: string;
  sets: EditorSet[];
};

/** One plan-day exercise, pre-resolved server-side for plan mode. */
export type PlanPrefillExercise = {
  name: string;
  muscleGroup: string | null;
  kind: ExerciseKindData | null;
  target: string;
  sets: number;
  unit: "lb" | "kg";
  ghosts: GhostValue[];
};

export type PlanPrefill = {
  title: string;
  exercises: PlanPrefillExercise[];
};

export type LoggerMode = "create" | "edit" | "repeat" | "plan";

/** Ghost placeholders from a last-session lookup entry. */
export function ghostsFromHistory(sets: GhostSet[]): GhostValue[] {
  return sets.map((s) => ({
    weight: s.weight == null ? "" : String(s.weight),
    reps: s.reps == null ? "" : String(s.reps),
  }));
}

export const SET_TYPE_ORDER: SetType[] = [
  "working",
  "warmup",
  "dropset",
  "failure",
];
export const SET_TYPE_LABEL: Record<SetType, string> = {
  working: "Working set",
  warmup: "Warm-up",
  dropset: "Drop set",
  failure: "To failure",
};

// Random per-load base so ids from a restored localStorage draft can never
// collide with freshly generated ones in the same session.
const _uidBase = Math.random().toString(36).slice(2, 7);
let _uid = 0;
export function uid(): string {
  _uid += 1;
  return `w${_uidBase}${_uid}`;
}

export function isNumeric(v: string): boolean {
  return v.trim() !== "" && !Number.isNaN(Number(v));
}

/**
 * A fresh set row. Live sessions (create/plan/repeat) start UNCHECKED: the
 * member checks sets off as they train, which is also what kicks the auto
 * rest timer. Edit mode passes completed=true, since a set added to an
 * already-saved workout was obviously performed. At finish, any typed-but-
 * unchecked set auto-completes (see the submit flow), so retro-logging by
 * just typing numbers still counts everything.
 */
export function blankSet(prev?: EditorSet, completed = false): EditorSet {
  return {
    uid: uid(),
    weight: prev?.weight ?? "",
    reps: prev?.reps ?? "",
    unit: prev?.unit ?? "lb",
    rpe: "",
    setType: "working",
    completed,
  };
}

export function fromWorkout(w: WorkoutData): EditorExercise[] {
  return w.exercises.map((ex, i) => ({
    uid: uid(),
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    kind: ex.kind ?? null,
    linkedWithPrev:
      i > 0 &&
      ex.supersetGroup != null &&
      w.exercises[i - 1].supersetGroup === ex.supersetGroup,
    notes: ex.notes ?? "",
    sets:
      ex.sets.length > 0
        ? ex.sets.map((s) => ({
            uid: uid(),
            weight: s.weight == null ? "" : String(s.weight),
            reps: s.reps == null ? "" : String(s.reps),
            unit: s.unit,
            rpe: s.rpe == null ? "" : String(s.rpe),
            setType: s.setType,
            completed: s.completed,
          }))
        : [blankSet(undefined, true)],
  }));
}

/** Repeat mode: same exercises and set layout, but values EMPTY with last
 *  time's numbers ghosted, sets unchecked: "do it again", not "already did
 *  it". (The old dialog copied the values in as if already performed.) */
export function fromWorkoutAsRepeat(w: WorkoutData): EditorExercise[] {
  return w.exercises.map((ex, i) => ({
    uid: uid(),
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    kind: ex.kind ?? null,
    ghosts: ex.sets.map((s) => ({
      weight: s.weight == null ? "" : String(s.weight),
      reps: s.reps == null ? "" : String(s.reps),
    })),
    linkedWithPrev:
      i > 0 &&
      ex.supersetGroup != null &&
      w.exercises[i - 1].supersetGroup === ex.supersetGroup,
    notes: "",
    sets:
      ex.sets.length > 0
        ? ex.sets.map((s) => ({
            uid: uid(),
            weight: "",
            reps: "",
            unit: s.unit,
            rpe: "",
            setType: s.setType,
            completed: false,
          }))
        : [blankSet()],
  }));
}

/**
 * Build the editor state for a plan day: every prescribed exercise with its
 * set count laid out, values EMPTY, and last session's numbers (or the plan's
 * prescription) ghosted as placeholders. Sets start unchecked; the member
 * checks them off as they train, and checking an empty set adopts its ghost.
 */
export function fromPlan(exercises: PlanPrefillExercise[]): EditorExercise[] {
  return exercises.map((ex) => ({
    uid: uid(),
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    kind: ex.kind,
    target: ex.target,
    ghosts: ex.ghosts,
    linkedWithPrev: false,
    notes: "",
    sets: Array.from({ length: ex.sets }, () => ({
      uid: uid(),
      weight: "",
      reps: "",
      unit: ex.unit,
      rpe: "",
      setType: "working" as const,
      completed: false,
    })),
  }));
}

/** The ghost for set index `i`; the last known ghost repeats for extra sets. */
export function ghostAt(ex: EditorExercise, i: number): GhostValue | null {
  if (!ex.ghosts || ex.ghosts.length === 0) {
    return null;
  }
  return ex.ghosts[Math.min(i, ex.ghosts.length - 1)];
}

/**
 * Superset group number (1, 2, …) per exercise, derived from the linked-with-
 * above chains; null = standalone. Used for both the visual grouping and the
 * saved supersetGroup values.
 */
export function deriveGroups(exercises: EditorExercise[]): (number | null)[] {
  const groups: (number | null)[] = exercises.map(() => null);
  let counter = 0;
  for (let i = 1; i < exercises.length; i++) {
    if (!exercises[i].linkedWithPrev) {
      continue;
    }
    if (groups[i - 1] == null) {
      counter += 1;
      groups[i - 1] = counter;
    }
    groups[i] = groups[i - 1];
  }
  return groups;
}

/** "Last time (Jun 28): 185 lb × 8, 185 lb × 8, 185 lb × 6" for the header. */
export function formatLastLine(
  last: LastExerciseLog,
  kind: ExerciseKindData
): string {
  const date = formatCalendarDay(new Date(last.performedAt), {
    month: "short",
    day: "numeric",
  });
  const shown = last.sets.slice(0, 5).map((s) => {
    if (kind === "timed") {
      return s.reps == null ? "?" : `${s.reps}s`;
    }
    const load = s.weight == null ? "BW" : `${s.weight} ${s.unit}`;
    return s.reps == null ? load : `${load} × ${s.reps}`;
  });
  const extra = last.sets.length - shown.length;
  return `Last time (${date}): ${shown.join(", ")}${extra > 0 ? ` +${extra}` : ""}`;
}

// ---------------------------------------------------------------------------
// Live session math: the running totals in the sticky stats strip, and the
// per-set PR check that flags a personal record the moment it's typed.
// ---------------------------------------------------------------------------

/** Live total volume (completed non-warmup sets, weight × reps) in lb. */
export function liveVolumeLb(exercises: EditorExercise[]): number {
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.completed || s.setType === "warmup") {
        continue;
      }
      const w = Number(s.weight);
      const r = Number(s.reps);
      if (s.weight.trim() && s.reps.trim() && !Number.isNaN(w) && !Number.isNaN(r)) {
        total += toLb(w, s.unit) * r;
      }
    }
  }
  return Math.round(total);
}

/** Completed sets vs total sets across the session (warmups count; the strip
 *  answers "how far through the session am I?"). */
export function liveSetProgress(exercises: EditorExercise[]): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      total += 1;
      if (s.completed) {
        done += 1;
      }
    }
  }
  return { done, total };
}

export type SetPrKind = "weight" | "e1rm" | "reps";

/**
 * Does this typed set beat the member's all-time best for the exercise?
 * Returns the strongest claim it can make (heaviest weight > best e1RM > most
 * reps) or null. Only completed, non-warmup sets with real numbers qualify.
 */
export function detectSetPr(
  baseline: PrBaseline | undefined,
  set: EditorSet,
  kind: ExerciseKindData
): SetPrKind | null {
  if (!set.completed || set.setType === "warmup" || kind === "timed") {
    return null;
  }
  const weight = set.weight.trim() ? Number(set.weight) : null;
  const reps = set.reps.trim() ? Number(set.reps) : null;
  if (weight != null && Number.isNaN(weight)) {
    return null;
  }
  if (reps != null && Number.isNaN(reps)) {
    return null;
  }
  // No history at all: the first logged set of a new exercise isn't a "PR",
  // it's a starting point. Stay quiet.
  if (!baseline) {
    return null;
  }
  if (weight != null && weight > 0 && toLb(weight, set.unit) > baseline.bestWeightLb) {
    return "weight";
  }
  if (weight != null && weight > 0 && reps != null && reps > 0) {
    const e = epley1RM(weight, reps);
    if (e != null && toLb(e, set.unit) > baseline.bestE1RMLb) {
      return "e1rm";
    }
  }
  if (
    kind === "bodyweight" &&
    reps != null &&
    reps > 0 &&
    reps > baseline.bestReps
  ) {
    return "reps";
  }
  return null;
}

export const PR_LABEL: Record<SetPrKind, string> = {
  weight: "Heaviest ever",
  e1rm: "est. 1RM PR",
  reps: "Rep PR",
};

// ---------------------------------------------------------------------------
// Warm-up ramp generator: from a target working weight, the standard
// percentage ladder strength coaches prescribe (bar → 40% → 60% → 80%).
// Rounded to the plates that exist (5 lb / 2.5 kg increments).
// ---------------------------------------------------------------------------

export type WarmupStep = { weight: number; reps: number };

export function warmupRamp(
  workingWeight: number,
  unit: "lb" | "kg"
): WarmupStep[] {
  const bar = unit === "lb" ? 45 : 20;
  const inc = unit === "lb" ? 5 : 2.5;
  const round = (w: number) => Math.max(bar, Math.round(w / inc) * inc);
  if (!Number.isFinite(workingWeight) || workingWeight <= bar) {
    return [];
  }
  const steps: WarmupStep[] = [{ weight: bar, reps: 10 }];
  for (const [pct, reps] of [
    [0.4, 5],
    [0.6, 3],
    [0.8, 1],
  ] as const) {
    const w = round(workingWeight * pct);
    // Skip rungs that collapse into the bar or into each other.
    if (w > (steps.at(-1)?.weight ?? 0)) {
      steps.push({ weight: w, reps });
    }
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Draft persistence: an in-progress session survives a locked phone, a killed
// tab, or an accidental back-swipe. Serialized to localStorage on every edit;
// the page offers to resume it on return. (Edit mode is excluded; reopening
// an old workout for correction isn't an in-progress session.)
// ---------------------------------------------------------------------------

export const DRAFT_KEY = "chad:workout-draft:v1";

export type SessionDraft = {
  mode: LoggerMode;
  startedAt: number | null;
  title: string;
  date: string;
  durationMin: string;
  notes: string;
  exercises: EditorExercise[];
  savedAt: number;
};

export function readDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SessionDraft;
    if (!Array.isArray(parsed.exercises)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft(draft: SessionDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full/blocked; drafts are a convenience, never fatal.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Anything worth keeping? An untouched prefill isn't. */
export function draftIsMeaningful(exercises: EditorExercise[]): boolean {
  return exercises.some((ex) =>
    ex.sets.some((s) => s.completed || s.weight.trim() || s.reps.trim())
  );
}
