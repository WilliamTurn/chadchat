import type { Goal, User } from "@/lib/db/schema";
import { parseTargetDate, weeksUntil } from "@/lib/goals/feasibility";

/**
 * The checkpoint math behind a Future You forecast (FEAT-29): given the
 * member's active goal and stats, compute the checkpoint weeks and the
 * expected weight at each one. Pure and React-free.
 *
 * The member's own target date is the timeline anchor (owner direction s176):
 * they told Chad how fast they want it, so the forecast lands on THEIR date,
 * whether that's 8 weeks or 10 years. Physiology demotes from author to
 * validator: when the chosen date demands a rate faster than a body can
 * deliver, the timeline extends to the earliest defensible date and the plan
 * says so (memberDateTooFast), so Chad can call it out instead of the math
 * silently promising the impossible. Goals with no usable date fall back to
 * the computed honest pace, exactly as before.
 *
 * Rates (per week):
 * - Fat loss: ~0.8% of current bodyweight, clamped to 1-3 lb (0.45-1.35 kg).
 *   Sustainable coaching pace, used when the member set no date. The fastest
 *   defensible pace (validator ceiling) is 1.5% of bodyweight per week.
 * - Muscle gain, by training age: beginner 0.5 lb, intermediate 0.35 lb,
 *   advanced 0.25 lb. Lean-gain rates; the validator ceiling is 1% of
 *   bodyweight per week (a hard bulk, scale weight not lean mass).
 * - No usable numbers (custom/lift/measurement goals): the member's date when
 *   set, else a 12-week qualitative transformation window; the prompt
 *   architect describes change qualitatively instead of via weight deltas.
 */

const LB_PER_KG = 2.204_62;

const MIN_TOTAL_WEEKS = 6;
// Only applies when the member set NO date: keeps a computed extreme goal's
// end sane (3 years covers a 300 lb transformation at an honest pace). A
// member-chosen date is never clamped from above: their date is their date.
const MAX_TOTAL_WEEKS = 156;
// A member-chosen date can be as near as next week; anything under a week
// rounds up so the math has one whole week to work with.
const MIN_MEMBER_WEEKS = 1;
const DEFAULT_TOTAL_WEEKS = 12;
const FIRST_CHECKPOINT_WEEK = 4;

export type WeightUnit = "lb" | "kg";

export type Checkpoint = {
  weekOffset: number;
  /** Expected bodyweight at this checkpoint (goal unit), null when the goal
   *  has no usable weight numbers. */
  expectedWeight: number | null;
};

export type MilestonePlan = {
  unit: WeightUnit;
  direction: "loss" | "gain" | "recomp";
  startWeight: number | null;
  targetWeight: number | null;
  /** Absolute per-week change in `unit`; null for qualitative plans. */
  weeklyRate: number | null;
  /** Weeks to the goal frame: the member's chosen date when they set one
   *  (raised to the earliest defensible date if theirs was too fast), else
   *  the computed honest pace clamped 6-156. The final frame is always the
   *  goal achieved. */
  totalWeeks: number;
  /** Who authored the timeline: the member's own target date, or the
   *  computed honest pace when no usable date was set. */
  paceSource: "member-date" | "computed";
  /** Training-intensity character of the required weekly rate, for the
   *  architect and captions; null for qualitative plans. */
  paceBand: "gentle" | "standard" | "aggressive" | null;
  /** True when the member's chosen date demanded a physiologically
   *  impossible rate and the timeline was extended to the earliest
   *  defensible date; Chad should say so. */
  memberDateTooFast: boolean;
  /** 2-3 dated work checkpoints, ascending; the last is the goal week. */
  checkpoints: Checkpoint[];
  /** The quit frame lands at the same date as the goal week. */
  quitWeek: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function goalUnit(goal: Goal): WeightUnit {
  return (goal.unit ?? "").trim().toLowerCase().startsWith("k") ? "kg" : "lb";
}

function lossRatePerWeek(currentWeight: number, unit: WeightUnit): number {
  // ~0.8% of bodyweight per week. Very heavy members genuinely lose faster
  // (3+ lb/week early is normal coaching reality), so the ceiling is 3 lb
  // (1.35 kg), not 2: it keeps big transformations' goal dates honest instead
  // of stretching them with a one-size cap.
  const pct = currentWeight * 0.008;
  return unit === "kg"
    ? Math.min(1.35, Math.max(0.45, pct))
    : Math.min(3, Math.max(1, pct));
}

function gainRatePerWeek(
  experience: User["experienceLevel"],
  unit: WeightUnit
): number {
  const lbRate =
    experience === "advanced"
      ? 0.25
      : experience === "intermediate"
        ? 0.35
        : 0.5;
  return unit === "kg" ? lbRate / LB_PER_KG : lbRate;
}

/**
 * The validator ceiling: the fastest defensible weekly change for this body.
 * Faster than this and the date is fantasy (crash-diet muscle loss on the way
 * down, mostly fat on the way up), so a member date demanding more gets
 * extended to this pace's landing date.
 */
function fastestRatePerWeek({
  direction,
  startWeight,
  unit,
  experience,
}: {
  direction: "loss" | "gain";
  startWeight: number;
  unit: WeightUnit;
  experience: User["experienceLevel"];
}): number {
  if (direction === "loss") {
    // 1.5% of bodyweight per week, same floor as the sustainable rate so a
    // light member's ceiling never drops below a real-world 1 lb week.
    const pct = startWeight * 0.015;
    return unit === "kg" ? Math.max(0.45, pct) : Math.max(1, pct);
  }
  // Gaining: 1% of bodyweight per week is a hard bulk (scale weight, not lean
  // mass); never below the lean rate itself.
  const pct = startWeight * 0.01;
  return Math.max(gainRatePerWeek(experience, unit), pct);
}

/** Training-intensity character of the required pace, as % of start weight
 *  per week. Drives how the architect and Chad talk about the plan. */
function paceBandFor({
  direction,
  rate,
  startWeight,
}: {
  direction: "loss" | "gain" | "recomp";
  rate: number;
  startWeight: number | null;
}): "gentle" | "standard" | "aggressive" | null {
  if (startWeight == null || startWeight <= 0 || direction === "recomp") {
    return null;
  }
  const pct = (rate / startWeight) * 100;
  if (direction === "loss") {
    return pct <= 0.5 ? "gentle" : pct <= 1 ? "standard" : "aggressive";
  }
  return pct <= 0.25 ? "gentle" : pct <= 0.5 ? "standard" : "aggressive";
}

/** The member's own goal date as whole weeks from now; null when the goal has
 *  no parseable date or the date already passed (stale, so the computed pace
 *  takes over rather than forecasting into a week that's gone). */
function memberWeeksFor(goal: Goal): number | null {
  const date = parseTargetDate(goal.targetDate);
  if (!date) {
    return null;
  }
  const weeks = weeksUntil(date);
  if (weeks <= 0) {
    return null;
  }
  return Math.max(MIN_MEMBER_WEEKS, Math.ceil(weeks));
}

function directionFor(
  user: User,
  delta: number | null
): MilestonePlan["direction"] {
  if (delta != null && delta !== 0) {
    return delta < 0 ? "loss" : "gain";
  }
  if (user.primaryGoal === "fat_loss") {
    return "loss";
  }
  if (user.primaryGoal === "muscle" || user.primaryGoal === "strength") {
    return "gain";
  }
  return "recomp";
}

/** Checkpoint weeks: week 4, the midpoint (when it's distinct), and the goal
 *  week, at most 3 frames so the image bill stays bounded. */
function checkpointWeeks(totalWeeks: number): number[] {
  if (totalWeeks <= FIRST_CHECKPOINT_WEEK) {
    return [totalWeeks];
  }
  const weeks = new Set<number>([FIRST_CHECKPOINT_WEEK]);
  const mid = Math.round(totalWeeks / 2);
  if (mid > FIRST_CHECKPOINT_WEEK + 1 && mid < totalWeeks - 1) {
    weeks.add(mid);
  }
  weeks.add(totalWeeks);
  return [...weeks].sort((a, b) => a - b);
}

/**
 * Build the checkpoint plan for a goal. `currentWeight` is the member's trend
 * weight converted to the goal's unit (the app's one canonical current weight),
 * null when they have no weigh-ins.
 */
export function buildMilestonePlan({
  goal,
  user,
  currentWeight,
}: {
  goal: Goal;
  user: User;
  currentWeight: number | null;
}): MilestonePlan {
  const unit = goalUnit(goal);
  const isWeightGoal =
    (goal.metric === "weight" || goal.metric === "bodyfat") &&
    goal.targetValue != null;

  // Anchor on where they ARE today (trend weight), falling back to the
  // weight stored when the goal was created.
  const startWeight = currentWeight ?? goal.startValue ?? null;
  const targetWeight =
    isWeightGoal && goal.metric === "weight" ? goal.targetValue : null;

  const delta =
    startWeight != null && targetWeight != null
      ? round1(targetWeight - startWeight)
      : null;
  const direction = directionFor(user, delta);
  const memberWeeks = memberWeeksFor(goal);

  if (delta == null || delta === 0) {
    // Qualitative plan: the member's own window when they set a date, else
    // 12 weeks of visible change. No weight math either way.
    const totalWeeks = memberWeeks ?? DEFAULT_TOTAL_WEEKS;
    return {
      unit,
      direction,
      startWeight,
      targetWeight,
      weeklyRate: null,
      totalWeeks,
      paceSource: memberWeeks != null ? "member-date" : "computed",
      paceBand: null,
      memberDateTooFast: false,
      checkpoints: checkpointWeeks(totalWeeks).map((weekOffset) => ({
        weekOffset,
        expectedWeight: null,
      })),
      quitWeek: totalWeeks,
    };
  }

  const anchorWeight = startWeight ?? Math.abs(delta);
  const sustainableRate =
    direction === "loss"
      ? lossRatePerWeek(anchorWeight, unit)
      : gainRatePerWeek(user.experienceLevel, unit);

  let totalWeeks: number;
  let paceSource: MilestonePlan["paceSource"];
  let memberDateTooFast = false;
  if (memberWeeks != null) {
    // The member told Chad how fast they want it: their date is the anchor.
    // Physiology only steps in as a validator when the date demands a rate
    // no body can deliver, extending to the earliest defensible date.
    const fastestWeeks = Math.max(
      MIN_MEMBER_WEEKS,
      Math.ceil(
        Math.abs(delta) /
          fastestRatePerWeek({
            direction: direction === "loss" ? "loss" : "gain",
            startWeight: anchorWeight,
            unit,
            experience: user.experienceLevel,
          })
      )
    );
    paceSource = "member-date";
    if (memberWeeks < fastestWeeks) {
      totalWeeks = fastestWeeks;
      memberDateTooFast = true;
    } else {
      totalWeeks = memberWeeks;
    }
  } else {
    paceSource = "computed";
    totalWeeks = Math.min(
      MAX_TOTAL_WEEKS,
      Math.max(MIN_TOTAL_WEEKS, Math.ceil(Math.abs(delta) / sustainableRate))
    );
  }

  // The pace the timeline actually implies, so checkpoint weights walk evenly
  // to the goal frame on the goal date (a 10-year goal projects a 10-year
  // stroll, not a 20-week sprint followed by years of flatline).
  const rate = Math.abs(delta) / totalWeeks;
  const signedRate = direction === "loss" ? -rate : rate;

  const checkpoints = checkpointWeeks(totalWeeks).map((weekOffset) => {
    const projected = (startWeight as number) + signedRate * weekOffset;
    // Never project past the target: the last frame IS the goal.
    const capped =
      direction === "loss"
        ? Math.max(projected, targetWeight as number)
        : Math.min(projected, targetWeight as number);
    return { weekOffset, expectedWeight: round1(capped) };
  });

  return {
    unit,
    direction,
    startWeight,
    targetWeight,
    weeklyRate: round1(rate),
    totalWeeks,
    paceSource,
    paceBand: paceBandFor({ direction, rate, startWeight }),
    memberDateTooFast,
    checkpoints,
    quitWeek: totalWeeks,
  };
}
