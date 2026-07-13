/**
 * Cross-domain Progress overview computations (FIX-32, P56-A). Pure module:
 * no DB, no React. This is the ONE module that computes the overview's
 * windowed summary numbers (the one-canonical-value law); the registered
 * metrics `nutrition.adherence.window`, `hydration.avg.window`,
 * `hydration.daysAtGoal.window`, `sleep.avg.window`,
 * `sleep.nightsAtGoal.window`, and `engagement.consistency.window` all pin
 * their source symbols here.
 *
 * Grading law (FIX-07): every day grades against the target that was active
 * ON THAT DAY (the caller resolves per-day targets via the day-keyed read
 * APIs); averages divide by LOGGED days only (the LC-9 denominator law);
 * unlogged days are never zeros.
 */

import { MS_PER_DAY } from "@/lib/chart/trend";
import type { Coverage } from "@/lib/contracts/data-state";

/** One graded day for the adherence visuals. */
export type GradedDay = {
  /** 00:00-UTC anchor of the member-local day. */
  t: number;
  /**
   * hit    = logged and met that day's target
   * missed = logged and did not meet that day's target
   * logged = logged, but no target existed that day (not gradable)
   * unlogged = nothing logged that day (never rendered as zero)
   */
  status: "hit" | "missed" | "logged" | "unlogged";
  value: number | null;
  target: number | null;
};

export type WindowSummary = {
  /** Every member-local day in the window, oldest first, graded. */
  days: GradedDay[];
  loggedDays: number;
  /** Days that met their own day's target (among logged, gradable days). */
  daysAtTarget: number;
  /** Logged and gradable days (the honest adherence denominator). */
  gradableDays: number;
  /** Mean value per LOGGED day (LC-9); null when nothing is logged. */
  average: number | null;
  coverage: Coverage;
};

/** Day anchors (00:00 UTC ms) for a window of `days` ending at `endDayMs`. */
export function windowDayAnchorsMs(endDayMs: number, days: number): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(endDayMs - i * MS_PER_DAY);
  }
  return out;
}

/**
 * Grade one domain's window. `hit` says whether a logged value met that
 * day's target; a null target makes the day logged-but-not-gradable.
 */
export function summarizeWindow(args: {
  dayAnchorsMs: number[];
  /** day anchor ms -> logged total for that day (absent = unlogged). */
  valueByDay: ReadonlyMap<number, number>;
  /** day anchor ms -> the target active ON that day (FIX-07), or null. */
  targetByDay: ReadonlyMap<number, number | null>;
  hit: (value: number, target: number) => boolean;
}): WindowSummary {
  const days: GradedDay[] = args.dayAnchorsMs.map((t) => {
    const value = args.valueByDay.get(t);
    if (value == null) {
      return { t, status: "unlogged", value: null, target: args.targetByDay.get(t) ?? null };
    }
    const target = args.targetByDay.get(t) ?? null;
    if (target == null) {
      return { t, status: "logged", value, target: null };
    }
    return {
      t,
      status: args.hit(value, target) ? "hit" : "missed",
      value,
      target,
    };
  });

  const logged = days.filter((d) => d.status !== "unlogged");
  const gradable = days.filter(
    (d) => d.status === "hit" || d.status === "missed"
  );
  const hits = days.filter((d) => d.status === "hit");
  const sum = logged.reduce((acc, d) => acc + (d.value ?? 0), 0);
  const loggedAnchors = logged.map((d) => d.t);
  const spanDays =
    logged.length >= 2
      ? Math.round(
          (Math.max(...loggedAnchors) - Math.min(...loggedAnchors)) /
            MS_PER_DAY
        )
      : 0;

  return {
    days,
    loggedDays: logged.length,
    daysAtTarget: hits.length,
    gradableDays: gradable.length,
    average: logged.length > 0 ? sum / logged.length : null,
    coverage: {
      loggedDays: logged.length,
      windowDays: args.dayAnchorsMs.length,
      points: logged.length,
      spanDays,
    },
  };
}

/**
 * Calorie-adherence tolerance: a logged day counts as within target when its
 * calories land inside this band around that day's target. Symmetric on
 * purpose: both cut and bulk targets are numbers to HIT, and adherence is
 * relative to the explicit target, never a moral grade (doc 04 calc rules).
 */
export const CALORIE_TOLERANCE = 0.1;

/** Source symbol for `nutrition.adherence.window`. */
export function nutritionAdherenceWindow(args: {
  dayAnchorsMs: number[];
  caloriesByDay: ReadonlyMap<number, number>;
  targetByDay: ReadonlyMap<number, number | null>;
}): WindowSummary {
  return summarizeWindow({
    dayAnchorsMs: args.dayAnchorsMs,
    valueByDay: args.caloriesByDay,
    targetByDay: args.targetByDay,
    hit: (value, target) => Math.abs(value - target) <= target * CALORIE_TOLERANCE,
  });
}

/** Source symbol for `hydration.avg.window` + `hydration.daysAtGoal.window`. */
export function hydrationWindow(args: {
  dayAnchorsMs: number[];
  mlByDay: ReadonlyMap<number, number>;
  goalMlByDay: ReadonlyMap<number, number | null>;
}): WindowSummary {
  return summarizeWindow({
    dayAnchorsMs: args.dayAnchorsMs,
    valueByDay: args.mlByDay,
    targetByDay: args.goalMlByDay,
    hit: (value, target) => value >= target,
  });
}

/** Source symbol for `sleep.avg.window` + `sleep.nightsAtGoal.window`. */
export function sleepWindow(args: {
  dayAnchorsMs: number[];
  minutesByDay: ReadonlyMap<number, number>;
  goalMinutesByDay: ReadonlyMap<number, number | null>;
}): WindowSummary {
  return summarizeWindow({
    dayAnchorsMs: args.dayAnchorsMs,
    valueByDay: args.minutesByDay,
    targetByDay: args.goalMinutesByDay,
    hit: (value, target) => value >= target,
  });
}

/* ------------------------------------------------------------ consistency */

export type ConsistencyDay = {
  /** 00:00-UTC anchor of the member-local day. */
  t: number;
  /** How many domains logged anything that day (0 = nothing logged). */
  domains: number;
};

export type ConsistencyWindow = {
  days: ConsistencyDay[];
  /** Days with at least one logged action in the window. */
  loggedDays: number;
  windowDays: number;
};

/**
 * Source symbol for `engagement.consistency.window`: days with at least one
 * logged action across any domain, plus the per-day domain count that powers
 * the consistency calendar's intensity scale.
 */
export function consistencyWindow(args: {
  dayAnchorsMs: number[];
  /** Per domain, the set of member-local day anchors with >= 1 logged row. */
  domainDays: ReadonlyArray<ReadonlySet<number>>;
}): ConsistencyWindow {
  const days: ConsistencyDay[] = args.dayAnchorsMs.map((t) => ({
    t,
    domains: args.domainDays.reduce(
      (acc, set) => acc + (set.has(t) ? 1 : 0),
      0
    ),
  }));
  return {
    days,
    loggedDays: days.filter((d) => d.domains > 0).length,
    windowDays: days.length,
  };
}
