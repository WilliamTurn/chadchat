/**
 * Pure workout math: 1RM estimates, volume, and personal records. No DB / React
 * imports so it's usable in server components, the chat-prompt formatter, and
 * client components alike. Mixed lb/kg sets are normalized to lb for any
 * cross-set comparison so a kg PR doesn't beat a heavier lb set by accident.
 *
 * EXERCISE IDENTITY (FIX-33/34): every function here groups by the raw
 * `name.trim().toLowerCase()` key. Analytics surfaces must therefore pass
 * workouts through `canonicalizeWorkouts` (lib/workouts/exercise-identity.ts,
 * with the member's ResolveOptions from lib/workouts/canonical.ts) BEFORE
 * calling in, so records, PRs, volume, and trends deduplicate across aliases
 * ("Bench Press" vs "Barbell Bench Press"). Resolution is read-time only;
 * logged rows are never rewritten.
 */

import { LB_PER_KG } from "@/lib/contracts/units";
import { calendarDayAnchorInTz } from "@/lib/date";

export type WeightUnit = "lb" | "kg";
export type SetType = "warmup" | "working" | "dropset" | "failure";

export type SetData = {
  weight: number | null;
  reps: number | null;
  unit: WeightUnit;
  rpe: number | null;
  setType: SetType;
  completed: boolean;
};

export type ExerciseKindData = "weighted" | "bodyweight" | "timed";

export type ExerciseData = {
  name: string;
  muscleGroup: string | null;
  // Logging-kind snapshot; null on rows logged before kinds existed (weighted).
  kind?: ExerciseKindData | null;
  // Superset/circuit grouping (FEAT-10): consecutive exercises sharing the
  // same number were performed back-to-back; null/absent = standalone.
  supersetGroup?: number | null;
  notes: string | null;
  sets: SetData[];
};

/** The serializable shape pages map DB rows into and pass to client components. */
export type WorkoutData = {
  id: string;
  title: string;
  performedAt: string; // ISO
  durationSeconds: number | null;
  notes: string | null;
  exercises: ExerciseData[];
};

export function toLb(weight: number, unit: WeightUnit): number {
  return unit === "lb" ? weight : weight * LB_PER_KG;
}

/** Epley estimated one-rep max. Returns null when weight/reps are missing. */
export function epley1RM(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || reps <= 0) {
    return null;
  }
  if (reps === 1) {
    return weight;
  }
  return weight * (1 + reps / 30);
}

/** Sets that count toward PRs/volume — warmups are excluded. */
function isWorkingSet(s: SetData): boolean {
  return s.completed && s.setType !== "warmup";
}

/** Total volume (weight × reps) of a workout, in lb. */
export function workoutVolumeLb(w: WorkoutData): number {
  let total = 0;
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (isWorkingSet(s) && s.weight != null && s.reps != null) {
        total += toLb(s.weight, s.unit) * s.reps;
      }
    }
  }
  return Math.round(total);
}

/** Total completed working sets in a workout. */
export function workoutSetCount(w: WorkoutData): number {
  let n = 0;
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (isWorkingSet(s)) {
        n++;
      }
    }
  }
  return n;
}

export type PersonalRecord = {
  exerciseName: string;
  /** Heaviest single working set, in its original unit. */
  bestWeight: number | null;
  bestWeightUnit: WeightUnit;
  bestWeightReps: number | null;
  /** Best estimated 1RM across all working sets, in lb. */
  bestEst1RM: number | null;
  est1RMUnit: WeightUnit;
  /** Most reps in any single working set. */
  bestReps: number | null;
  /** Best single-session volume for this exercise, in lb. */
  bestSessionVolume: number;
  lastPerformed: string; // ISO
  /** Source workouts (FIX-33: every record taps through to the session that
   *  set it). Null when the record has no qualifying set. */
  bestWeightWorkoutId: string | null;
  bestEst1RMWorkoutId: string | null;
  bestSessionVolumeWorkoutId: string | null;
  lastPerformedWorkoutId: string | null;
};

/**
 * Compute one PR record per exercise across all the user's workouts. Comparisons
 * normalize to lb; the heaviest set is reported back in the unit it was logged.
 */
export function computePersonalRecords(workouts: WorkoutData[]): PersonalRecord[] {
  const byName = new Map<
    string,
    {
      display: string;
      bestWeightLb: number;
      bestWeight: number;
      bestWeightUnit: WeightUnit;
      bestWeightReps: number | null;
      bestWeightWorkoutId: string | null;
      bestEst1RMLb: number;
      bestEst1RMWorkoutId: string | null;
      bestReps: number;
      bestSessionVolume: number;
      bestSessionVolumeWorkoutId: string | null;
      lastPerformed: number;
      lastPerformedWorkoutId: string | null;
      unitSeen: WeightUnit;
    }
  >();

  for (const w of workouts) {
    const performed = new Date(w.performedAt).getTime();
    for (const ex of w.exercises) {
      const key = ex.name.trim().toLowerCase();
      if (!key) {
        continue;
      }
      const sessionVolume = (() => {
        let v = 0;
        for (const s of ex.sets) {
          if (isWorkingSet(s) && s.weight != null && s.reps != null) {
            v += toLb(s.weight, s.unit) * s.reps;
          }
        }
        return Math.round(v);
      })();

      let rec = byName.get(key);
      if (!rec) {
        rec = {
          display: ex.name.trim(),
          bestWeightLb: 0,
          bestWeight: 0,
          bestWeightUnit: "lb",
          bestWeightReps: null,
          bestWeightWorkoutId: null,
          bestEst1RMLb: 0,
          bestEst1RMWorkoutId: null,
          bestReps: 0,
          bestSessionVolume: 0,
          bestSessionVolumeWorkoutId: null,
          lastPerformed: 0,
          lastPerformedWorkoutId: null,
          unitSeen: "lb",
        };
        byName.set(key, rec);
      }

      if (performed > rec.lastPerformed) {
        rec.lastPerformed = performed;
        rec.lastPerformedWorkoutId = w.id;
      }
      if (sessionVolume > rec.bestSessionVolume) {
        rec.bestSessionVolume = sessionVolume;
        rec.bestSessionVolumeWorkoutId = w.id;
      }

      for (const s of ex.sets) {
        if (!isWorkingSet(s)) {
          continue;
        }
        rec.unitSeen = s.unit;
        if (s.reps != null && s.reps > rec.bestReps) {
          rec.bestReps = s.reps;
        }
        if (s.weight != null) {
          const wl = toLb(s.weight, s.unit);
          if (wl > rec.bestWeightLb) {
            rec.bestWeightLb = wl;
            rec.bestWeight = s.weight;
            rec.bestWeightUnit = s.unit;
            rec.bestWeightReps = s.reps;
            rec.bestWeightWorkoutId = w.id;
          }
          const e = epley1RM(s.weight, s.reps);
          if (e != null) {
            const el = toLb(e, s.unit);
            if (el > rec.bestEst1RMLb) {
              rec.bestEst1RMLb = el;
              rec.bestEst1RMWorkoutId = w.id;
            }
          }
        }
      }
    }
  }

  return [...byName.values()]
    .map((r) => ({
      exerciseName: r.display,
      bestWeight: r.bestWeight > 0 ? r.bestWeight : null,
      bestWeightUnit: r.bestWeightUnit,
      bestWeightReps: r.bestWeightReps,
      bestEst1RM: r.bestEst1RMLb > 0 ? Math.round(r.bestEst1RMLb) : null,
      est1RMUnit: "lb" as WeightUnit,
      bestReps: r.bestReps > 0 ? r.bestReps : null,
      bestSessionVolume: r.bestSessionVolume,
      lastPerformed: new Date(r.lastPerformed).toISOString(),
      bestWeightWorkoutId: r.bestWeightWorkoutId,
      bestEst1RMWorkoutId: r.bestEst1RMWorkoutId,
      bestSessionVolumeWorkoutId: r.bestSessionVolumeWorkoutId,
      lastPerformedWorkoutId: r.lastPerformedWorkoutId,
    }))
    .sort((a, b) => (b.bestEst1RM ?? 0) - (a.bestEst1RM ?? 0));
}

/**
 * Total volume per day over time, oldest first, for the trend chart. Workouts
 * on the same calendar day are summed into one point — so two sessions in a
 * day (e.g. a repeated workout) render as a single bar rather than colliding
 * on an identical timestamp.
 *
 * Pass `timezone` to bucket by the MEMBER-LOCAL calendar day (the registered
 * training.volume.dailyTrend contract grain; the FIX-33 fix the registry
 * queued). Without it, buckets fall back to the UTC day — identical for
 * noon-UTC-anchored picked days, drifting only for logged-now sessions near
 * local midnight.
 */
export function volumeTrend(
  workouts: WorkoutData[],
  timezone?: string | null
): { t: number; volume: number }[] {
  const byDay = new Map<number, number>();
  for (const w of workouts) {
    const volume = workoutVolumeLb(w);
    if (volume <= 0) {
      continue;
    }
    const d = new Date(w.performedAt);
    const dayKey =
      timezone === undefined
        ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        : calendarDayAnchorInTz(d, timezone).getTime();
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + volume);
  }
  return [...byDay.entries()]
    .map(([t, volume]) => ({ t, volume }))
    .sort((a, b) => a.t - b.t);
}

/** Estimated-1RM trend for one exercise, oldest first. */
export function exercise1RMTrend(
  workouts: WorkoutData[],
  exerciseName: string
): { t: number; value: number }[] {
  const key = exerciseName.trim().toLowerCase();
  const points: { t: number; value: number }[] = [];
  for (const w of workouts) {
    let best = 0;
    for (const ex of w.exercises) {
      if (ex.name.trim().toLowerCase() !== key) {
        continue;
      }
      for (const s of ex.sets) {
        if (!isWorkingSet(s)) {
          continue;
        }
        const e = epley1RM(s.weight, s.reps);
        if (e != null) {
          best = Math.max(best, toLb(e, s.unit));
        }
      }
    }
    if (best > 0) {
      points.push({ t: new Date(w.performedAt).getTime(), value: Math.round(best) });
    }
  }
  return points.sort((a, b) => a.t - b.t);
}

// A prior set's numbers, ghosted into the logger as placeholders (the
// Hevy/Strong "previous" column) so the member sees what they did last time.
export type GhostSet = {
  weight: number | null;
  reps: number | null;
  unit: WeightUnit;
};

/** One exercise's most recent logged session: when, and the working sets. */
export type LastExerciseLog = {
  performedAt: string; // ISO of the session the sets came from
  sets: GhostSet[];
};

/**
 * The most recent session's sets for every exercise, keyed by lowercased name.
 * Backs last-session ghosting in the logger AND the inline "Last time" line
 * (FEAT-10): start a plan day (or add an exercise) and you see when you last
 * did it and what you lifted. Warmups are skipped; the ghost answers "what
 * did I work at?".
 */
export function lastSetsByExercise(
  workouts: WorkoutData[]
): Record<string, LastExerciseLog> {
  const latest = new Map<string, { t: number; log: LastExerciseLog }>();
  for (const w of workouts) {
    const t = new Date(w.performedAt).getTime();
    for (const ex of w.exercises) {
      const key = ex.name.trim().toLowerCase();
      if (!key) {
        continue;
      }
      const prev = latest.get(key);
      if (prev && prev.t >= t) {
        continue;
      }
      const sets = ex.sets
        .filter((s) => s.setType !== "warmup" && s.completed)
        .map((s) => ({ weight: s.weight, reps: s.reps, unit: s.unit }));
      if (sets.length > 0) {
        latest.set(key, { t, log: { performedAt: w.performedAt, sets } });
      }
    }
  }
  const out: Record<string, LastExerciseLog> = {};
  for (const [key, v] of latest) {
    out[key] = v.log;
  }
  return out;
}

// The all-time bests the live logger compares typed sets against, per
// exercise (lowercased name). Everything is normalized to lb so a kg set is
// judged fairly against a lb history.
export type PrBaseline = {
  bestWeightLb: number;
  bestE1RMLb: number;
  bestReps: number;
};

/**
 * All-time bests per exercise, for live PR detection while logging: the page
 * computes this once from history and the logger flags any typed set that
 * beats it ("PR" chip) the moment it's entered — not after saving.
 */
export function prBaselineByExercise(
  workouts: WorkoutData[]
): Record<string, PrBaseline> {
  const out: Record<string, PrBaseline> = {};
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const key = ex.name.trim().toLowerCase();
      if (!key) {
        continue;
      }
      const rec = out[key] ?? { bestWeightLb: 0, bestE1RMLb: 0, bestReps: 0 };
      for (const s of ex.sets) {
        if (!isWorkingSet(s)) {
          continue;
        }
        if (s.reps != null && s.reps > rec.bestReps) {
          rec.bestReps = s.reps;
        }
        if (s.weight != null) {
          const wl = toLb(s.weight, s.unit);
          if (wl > rec.bestWeightLb) {
            rec.bestWeightLb = wl;
          }
          const e = epley1RM(s.weight, s.reps);
          if (e != null) {
            rec.bestE1RMLb = Math.max(rec.bestE1RMLb, toLb(e, s.unit));
          }
        }
      }
      out[key] = rec;
    }
  }
  return out;
}

// One record-beating set, in the moment it happened: the atom of the PR
// timeline (FIX-33). `previous*` carry the pre-set running bests so a
// timeline entry can state the beaten mark; first-ever sessions emit nothing
// (a baseline, not a record).
export type PrEvent = {
  workoutId: string;
  workoutTitle: string;
  /** ISO of the session that set the record. */
  performedAt: string;
  exerciseName: string;
  /** Which running best(s) this set beat. */
  beatWeight: boolean;
  beatE1rm: boolean;
  /** The set as logged. */
  weight: number;
  reps: number | null;
  unit: WeightUnit;
  /** The set normalized to lb for comparisons/deltas. */
  weightLb: number;
  e1rmLb: number | null;
  /** Running bests BEFORE this set, in lb. */
  previousWeightLb: number;
  previousE1rmLb: number;
};

/**
 * Every record-beating working set across history, oldest first: replay
 * history, and for each exercise emit an event whenever a set beats every
 * prior session's best weight or best est. 1RM (first-ever sessions are a
 * baseline, not a record; timed exercises never PR). THE one PR-event
 * computation: `prCountsByWorkout` derives from it, so the history-card
 * pills and the Progress > Training PR timeline can never disagree.
 */
export function prEventsByWorkout(workouts: WorkoutData[]): PrEvent[] {
  const ordered = [...workouts].sort(
    (a, b) =>
      new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );
  const best = new Map<string, { weightLb: number; e1rmLb: number }>();
  const events: PrEvent[] = [];
  for (const w of ordered) {
    for (const ex of w.exercises) {
      const key = ex.name.trim().toLowerCase();
      if (!key || ex.kind === "timed") {
        continue;
      }
      const prior = best.get(key);
      let sessionBestWeight = prior?.weightLb ?? 0;
      let sessionBestE1rm = prior?.e1rmLb ?? 0;
      for (const s of ex.sets) {
        if (!isWorkingSet(s) || s.weight == null) {
          continue;
        }
        const wl = toLb(s.weight, s.unit);
        const e = epley1RM(s.weight, s.reps);
        const el = e != null ? toLb(e, s.unit) : 0;
        const beatWeight = prior != null && wl > sessionBestWeight;
        const beatE1rm = prior != null && el > sessionBestE1rm;
        if (beatWeight || beatE1rm) {
          events.push({
            workoutId: w.id,
            workoutTitle: w.title,
            performedAt: w.performedAt,
            exerciseName: ex.name.trim(),
            beatWeight,
            beatE1rm,
            weight: s.weight,
            reps: s.reps,
            unit: s.unit,
            weightLb: Math.round(wl),
            e1rmLb: e != null ? Math.round(el) : null,
            previousWeightLb: Math.round(sessionBestWeight),
            previousE1rmLb: Math.round(sessionBestE1rm),
          });
        }
        sessionBestWeight = Math.max(sessionBestWeight, wl);
        sessionBestE1rm = Math.max(sessionBestE1rm, el);
      }
      best.set(key, { weightLb: sessionBestWeight, e1rmLb: sessionBestE1rm });
    }
  }
  return events;
}

/**
 * How many personal records each workout set WHEN IT HAPPENED. Keyed by
 * workout id — backs the "2 records" pill on history cards and the
 * celebration screen. Derived from `prEventsByWorkout` (one computation).
 */
export function prCountsByWorkout(workouts: WorkoutData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const w of workouts) {
    counts[w.id] = 0;
  }
  for (const e of prEventsByWorkout(workouts)) {
    counts[e.workoutId]++;
  }
  return counts;
}

/** The single strongest set of a workout by est. 1RM ("Bench 185 lb × 8"). */
export function bestSetOfWorkout(w: WorkoutData): string | null {
  let best = 0;
  let label: string | null = null;
  for (const ex of w.exercises) {
    if (ex.kind === "timed") {
      continue;
    }
    for (const s of ex.sets) {
      if (!isWorkingSet(s) || s.weight == null || s.reps == null) {
        continue;
      }
      const e = epley1RM(s.weight, s.reps);
      if (e != null && toLb(e, s.unit) > best) {
        best = toLb(e, s.unit);
        label = `${ex.name} ${s.weight} ${s.unit} × ${s.reps}`;
      }
    }
  }
  return label;
}

/** "1h 12m" / "45m" / "30s" from a duration in seconds. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) {
    return null;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m`;
  }
  return `${s}s`;
}
