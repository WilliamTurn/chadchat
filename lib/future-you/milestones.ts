import type { Goal, User } from "@/lib/db/schema";

/**
 * The checkpoint math behind a Future You forecast (FEAT-29): given the
 * member's active goal and stats, compute physiologically honest checkpoint
 * weeks and the expected weight at each one. Pure and React-free, the same
 * evidence-based rates a coach would use, so the projected images are anchored
 * to numbers that can actually happen, not fantasy timelines. This is what
 * separates the feature from a gimmick: if the goal says 12 weeks but the math
 * says 20, the forecast shows the honest dates.
 *
 * Rates (per week):
 * - Fat loss: ~0.8% of current bodyweight, clamped to 1-3 lb (0.45-1.35 kg).
 *   Sustainable coaching pace: aggressive enough to show, safe enough to hold,
 *   with the higher ceiling honoring how fast very heavy members really lose.
 * - Muscle gain, by training age: beginner 0.5 lb, intermediate 0.35 lb,
 *   advanced 0.25 lb. Lean-gain rates for someone actually doing the work.
 * - No usable numbers (custom/lift/measurement goals): a 12-week qualitative
 *   transformation window with 4/8/12 checkpoints; the prompt architect
 *   describes change qualitatively instead of via weight deltas.
 */

const LB_PER_KG = 2.204_62;

const MIN_TOTAL_WEEKS = 6;
// The final frame is ALWAYS the goal fully achieved (owner order s175), so
// the ceiling exists only to keep a truly extreme goal's date sane: 3 years
// covers even a 300 lb transformation at an honest pace. Never clamp a real
// goal's end short of the goal itself.
const MAX_TOTAL_WEEKS = 156;
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
  /** Honest weeks to reach the target at the rate (clamped 6-156); the goal
   *  week, so the final frame is always the goal achieved. */
  totalWeeks: number;
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

  if (delta == null || delta === 0) {
    // Qualitative plan: 12 weeks of visible change, no weight math.
    const totalWeeks = DEFAULT_TOTAL_WEEKS;
    return {
      unit,
      direction,
      startWeight,
      targetWeight,
      weeklyRate: null,
      totalWeeks,
      checkpoints: checkpointWeeks(totalWeeks).map((weekOffset) => ({
        weekOffset,
        expectedWeight: null,
      })),
      quitWeek: totalWeeks,
    };
  }

  const rate =
    direction === "loss"
      ? lossRatePerWeek(startWeight ?? Math.abs(delta), unit)
      : gainRatePerWeek(user.experienceLevel, unit);
  const totalWeeks = Math.min(
    MAX_TOTAL_WEEKS,
    Math.max(MIN_TOTAL_WEEKS, Math.ceil(Math.abs(delta) / rate))
  );
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
    checkpoints,
    quitWeek: totalWeeks,
  };
}
