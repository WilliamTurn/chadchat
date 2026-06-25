/**
 * Pure workout math: 1RM estimates, volume, and personal records. No DB / React
 * imports so it's usable in server components, the chat-prompt formatter, and
 * client components alike. Mixed lb/kg sets are normalized to lb for any
 * cross-set comparison so a kg PR doesn't beat a heavier lb set by accident.
 */

const LB_PER_KG = 2.204_62;

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

export type ExerciseData = {
  name: string;
  muscleGroup: string | null;
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
      bestEst1RMLb: number;
      bestReps: number;
      bestSessionVolume: number;
      lastPerformed: number;
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
          bestEst1RMLb: 0,
          bestReps: 0,
          bestSessionVolume: 0,
          lastPerformed: 0,
          unitSeen: "lb",
        };
        byName.set(key, rec);
      }

      if (performed > rec.lastPerformed) {
        rec.lastPerformed = performed;
      }
      if (sessionVolume > rec.bestSessionVolume) {
        rec.bestSessionVolume = sessionVolume;
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
          }
          const e = epley1RM(s.weight, s.reps);
          if (e != null) {
            const el = toLb(e, s.unit);
            if (el > rec.bestEst1RMLb) {
              rec.bestEst1RMLb = el;
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
    }))
    .sort((a, b) => (b.bestEst1RM ?? 0) - (a.bestEst1RM ?? 0));
}

/** Per-workout total volume over time, oldest first, for the trend chart. */
export function volumeTrend(
  workouts: WorkoutData[]
): { t: number; volume: number }[] {
  return workouts
    .map((w) => ({
      t: new Date(w.performedAt).getTime(),
      volume: workoutVolumeLb(w),
    }))
    .filter((p) => p.volume > 0)
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
