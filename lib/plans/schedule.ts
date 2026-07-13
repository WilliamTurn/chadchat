import type { PlanDay } from "@/lib/validation/plan-days";

/**
 * The ONE typed model of a training plan's schedule (FIX-28 / DEC-06). Every
 * consumer (plan detail, Up next, workout selection, adherence) reads THIS
 * shape through `resolvePlanSchedule`, never `Plan.days` json or `Plan.detail`
 * text directly, so the four surfaces can never disagree about what the plan
 * prescribes.
 *
 * Storage forms, in resolution order:
 *   1. "structured"   - materialized PlanSession/PlanSessionExercise/
 *                       PlanSessionSet rows (session ids are real).
 *   2. "legacy-days"  - `Plan.days` json parsed on the fly (session ids null;
 *                       lib/db/plan-goal-queries.ts materializes lazily, the
 *                       syncPlanDays idiom).
 *   3. "document"     - text-only plan: no schedule; the raw `Plan.detail`
 *                       renders as the full document (DEC-06: never blocked,
 *                       never rewritten; the existing one-tap AI extraction
 *                       on /workouts remains the upgrade path).
 *
 * Pure module (no React, no DB, no node built-ins) so it is client-safe and
 * unit-testable.
 */

export type PlanSetPrescription = {
  position: number;
  type: "warmup" | "normal" | "failure" | "dropset";
  /** Fixed reps OR a range, never both. */
  reps: number | null;
  repRangeStart: number | null;
  repRangeEnd: number | null;
  weight: number | null;
  /** Timed work ("45s"), seconds. */
  durationSeconds: number | null;
  rpe: number | null;
};

export type PlanScheduleExercise = {
  /** Library-canonical name (the P34-E identity join point). */
  name: string;
  /** The prescription as Chad wrote it: working sets x the reps string. */
  sets: number;
  reps: string;
  weight: number | null;
  unit: "lb" | "kg";
  note: string | null;
  restSeconds: number | null;
  supersetGroup: number | null;
  /** Structured set-level expansion (Hevy RoutineSet shape). */
  setPrescriptions: PlanSetPrescription[];
};

export type PlanScheduleSession = {
  /** PlanSession.id once materialized; null in the legacy-days view. */
  id: string | null;
  /** 0-based rotation order. The schedule is a repeating rotation. */
  position: number;
  name: string;
  /** 0=Sunday..6=Saturday when pinned to a weekday; null = pure rotation. */
  weekday: number | null;
  exercises: PlanScheduleExercise[];
};

export type PlanSchedule = {
  planId: string;
  sessions: PlanScheduleSession[];
};

export type PlanScheduleView =
  | { kind: "structured"; schedule: PlanSchedule }
  | { kind: "legacy-days"; schedule: PlanSchedule }
  | { kind: "document" };

/**
 * Parse one prescription reps string into set-level structure. Conservative
 * on purpose: anything it cannot read stays null and the exercise row's raw
 * string remains the display form ("5 per side", "AMRAP").
 */
export function parseRepPrescription(reps: string): {
  reps: number | null;
  repRangeStart: number | null;
  repRangeEnd: number | null;
  durationSeconds: number | null;
} {
  const s = reps.trim();
  const fixed = s.match(/^(\d{1,4})$/);
  if (fixed) {
    return {
      reps: Number(fixed[1]),
      repRangeStart: null,
      repRangeEnd: null,
      durationSeconds: null,
    };
  }
  // "4-6", "8 - 12" (hyphen or unicode dashes).
  const range = s.match(/^(\d{1,4})\s*[-–—]\s*(\d{1,4})$/);
  if (range) {
    return {
      reps: null,
      repRangeStart: Number(range[1]),
      repRangeEnd: Number(range[2]),
      durationSeconds: null,
    };
  }
  // "45s", "45 sec", "90 seconds" (same suffix grammar the logger ghosts use).
  const timed = s.match(/^(\d{1,5})\s*s(ec(onds)?)?$/i);
  if (timed) {
    return {
      reps: null,
      repRangeStart: null,
      repRangeEnd: null,
      durationSeconds: Number(timed[1]),
    };
  }
  return {
    reps: null,
    repRangeStart: null,
    repRangeEnd: null,
    durationSeconds: null,
  };
}

/** Expand one exercise prescription into its set-level rows. */
export function expandSetPrescriptions(ex: {
  sets: number;
  reps: string;
  weight?: number | null;
}): PlanSetPrescription[] {
  const parsed = parseRepPrescription(ex.reps);
  const rows: PlanSetPrescription[] = [];
  for (let i = 0; i < ex.sets; i++) {
    rows.push({
      position: i,
      type: "normal",
      reps: parsed.reps,
      repRangeStart: parsed.repRangeStart,
      repRangeEnd: parsed.repRangeEnd,
      weight: ex.weight ?? null,
      durationSeconds: parsed.durationSeconds,
      rpe: null,
    });
  }
  return rows;
}

/** The legacy-days view: `Plan.days` json as a typed schedule (ids null). */
export function scheduleFromPlanDays(
  planId: string,
  days: PlanDay[]
): PlanSchedule {
  return {
    planId,
    sessions: days.map((day, position) => ({
      id: null,
      position,
      name: day.name,
      weekday: null,
      exercises: day.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight ?? null,
        unit: ex.unit ?? "lb",
        note: ex.note ?? null,
        restSeconds: null,
        supersetGroup: null,
        setPrescriptions: expandSetPrescriptions(ex),
      })),
    })),
  };
}

/**
 * A schedule session in the PlanDay shape the existing logger pipeline
 * (buildPlanPrefill, sessionFromPlanDay) consumes, so workout selection runs
 * off the SAME resolved schedule without a parallel code path.
 */
export function sessionToPlanDay(session: PlanScheduleSession): PlanDay {
  return {
    name: session.name,
    exercises: session.exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      unit: ex.unit,
      note: ex.note,
    })),
  };
}

/**
 * The plan's prescribed sessions per week. The rotation is capped at 7 days
 * (lib/validation/plan-days.ts), i.e. plans are weekly rotations, so the
 * session count IS the weekly prescription. This is the source for the
 * metrics.ts `training.sessions.thisWeek` plan-kind target (FIX-28).
 */
export function planSessionsPerWeek(schedule: PlanSchedule): number {
  return schedule.sessions.length;
}
