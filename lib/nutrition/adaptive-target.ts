/**
 * NUT-23 — adaptive calorie/macro targets (the MacroFactor-style weekly
 * recalibration, the beta tester's explicit ask).
 *
 * The idea: with a couple of weeks of honest logging, energy balance stops
 * being a formula guess and becomes arithmetic. If you averaged 2,400 kcal a
 * day and your weight trend fell 1 lb a week, your real daily expenditure is
 * about 2,400 + 3,500/7 ≈ 2,900 kcal. From that observed expenditure the
 * daily calorie target is re-derived toward the goal pace, protein stays
 * anchored, and carbs/fat absorb the change in their existing ratio.
 *
 * Everything here is PURE MATH computed in code (memory
 * `chad-accuracy-fix-at-data-layer`): Chad narrates these numbers, he never
 * invents them. Nothing is written to the member's targets without their
 * explicit apply (member consent, spec'd in MTLN NUT-23).
 *
 * No DB, no Date.now(): every result derives from the passed series, so the
 * unit tests can pin the math.
 */

import { ema, MS_PER_DAY, ratePerWeek, withinDays } from "@/lib/chart/trend";
import { KCAL_PER_GRAM } from "@/lib/nutrition/target-math";

/** How many trailing days of intake + trend feed the energy-balance window. */
export const WINDOW_DAYS = 14;

/** Energy density of a unit of bodyweight change. */
const KCAL_PER_UNIT = { lb: 3500, kg: 7700 } as const;

/** A day counts as "fully logged" only above this; below reads as a day the
 * member logged breakfast and gave up, which would fake a huge deficit. */
const LOGGED_DAY_MIN_KCAL = 1000;

/** How many fully-logged days the window must contain before the average
 * intake means anything. 10 of 14 tolerates a few missed days. */
const MIN_LOGGED_DAYS = 10;

/** Weigh-ins the trend window must contain for the rate to be trustworthy. */
const MIN_WINDOW_WEIGHINS = 4;

/** The newest weigh-in must be at most this stale, or the "current" trend
 * isn't current. */
const MAX_WEIGHIN_AGE_DAYS = 3;

/** Sanity bounds on the estimated expenditure: outside this range the inputs
 * are dishonest (heavy under-logging) and no recommendation is made. */
const MIN_EXPENDITURE = 1300;
const MAX_EXPENDITURE = 6000;

/** One recalibration never moves the calorie target more than this. Gentle
 * weekly nudges, not whiplash. */
const MAX_STEP_KCAL = 150;

/** Recommendations smaller than this are noise: hold instead. */
const MIN_DELTA_KCAL = 50;

/** Never recommend below this, whatever the arithmetic says. */
const CALORIE_FLOOR = 1200;

/** Within this distance of the goal weight the pace becomes maintenance. */
const AT_GOAL_TOLERANCE = { lb: 2, kg: 1 } as const;

/** Default goal pace (fraction of current bodyweight per week), clamped. */
const CUT_RATE_PCT = 0.0075; // -0.75%/wk
const CUT_RATE_BOUNDS = { lb: [0.5, 2], kg: [0.25, 0.9] } as const;
const GAIN_RATE_PCT = 0.0025; // +0.25%/wk
const GAIN_RATE_BOUNDS = { lb: [0.25, 0.5], kg: [0.1, 0.25] } as const;

export type WeightUnit = "lb" | "kg";

export type AdaptiveWeighIn = { t: number; weight: number; unit: WeightUnit };

export type AdaptiveIntakeDay = { t: number; calories: number };

export type AdaptiveTargetInputs = {
  /** All weigh-in history, oldest-first (the EMA needs the run-up). */
  weighIns: AdaptiveWeighIn[];
  /** Per-day logged calorie totals, oldest-first. Today should be excluded
   * by the caller (it's still being eaten). */
  intakeDays: AdaptiveIntakeDay[];
  /** "Now": the member's today anchor (ms). */
  nowMs: number;
  /** The member's current daily target (null fields allowed). */
  target: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  } | null;
  /** The active weight goal's target, in the same unit space as weigh-ins
   * (null = no weight goal = maintenance). */
  goalWeight: number | null;
};

export type AdaptiveRecommendation = {
  kind: "recommend";
  unit: WeightUnit;
  /** Estimated true daily expenditure, kcal. */
  expenditure: number;
  /** Average intake across the fully-logged window days, kcal. */
  avgIntake: number;
  /** Fully-logged days that fed the average. */
  loggedDays: number;
  /** Observed trend rate over the window, unit/week (negative = losing). */
  observedRate: number;
  /** The pace the recommendation aims for, unit/week (0 = maintenance). */
  desiredRate: number;
  /** Current smoothed trend weight. */
  trendWeight: number;
  /** The current calorie target the delta is measured from. */
  currentCalories: number;
  /** The recommended new daily target. */
  calories: number;
  deltaCalories: number;
  /** Recommended macro grams; null when the member has no complete macro
   * targets set (then only the calorie number changes). */
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export type AdaptiveResult =
  | AdaptiveRecommendation
  | { kind: "hold"; reason: "delta_too_small" }
  | {
      kind: "insufficient";
      reason:
        | "no_calorie_target"
        | "few_weighins"
        | "stale_weighins"
        | "few_logged_days"
        | "implausible_expenditure";
    };

const round25 = (n: number) => Math.round(n / 25) * 25;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The observed-energy-balance half of the engine, exposed on its own for
 * the target recommendation (calories-burned Phase 2): once these gates
 * pass, this expenditure OUTRANKS the Mifflin-St Jeor formula (plan §4.1
 * precedence rule, D1). Rates and weights are unrounded here; display
 * rounding happens at each surface's return point. */
export type ObservedEnergyBalance = {
  unit: WeightUnit;
  /** Estimated true daily expenditure, kcal. */
  expenditure: number;
  /** Average intake across the fully-logged window days, kcal. */
  avgIntake: number;
  /** Fully-logged days that fed the average. */
  loggedDays: number;
  /** Observed trend rate over the window, unit/week (negative = losing). */
  observedRate: number;
  /** Current smoothed trend weight. */
  trendWeight: number;
};

export type ObservedEnergyBalanceResult =
  | ({ kind: "ok" } & ObservedEnergyBalance)
  | {
      kind: "insufficient";
      reason:
        | "few_weighins"
        | "stale_weighins"
        | "few_logged_days"
        | "implausible_expenditure";
    };

/** Convert every weigh-in to the newest entry's unit (same convention as the
 * weekly report's trend block). */
function normalize(weighIns: AdaptiveWeighIn[]): {
  unit: WeightUnit;
  points: { t: number; weight: number }[];
} {
  const unit = weighIns.at(-1)?.unit ?? "lb";
  const LB_PER_KG = 2.204_62;
  return {
    unit,
    points: weighIns.map((w) => ({
      t: w.t,
      weight:
        w.unit === unit
          ? w.weight
          : unit === "lb"
            ? w.weight * LB_PER_KG
            : w.weight / LB_PER_KG,
    })),
  };
}

/** The default pace toward the goal from the current trend weight: a modest
 * cut or a lean-gain pace, or maintenance at/near/without a goal. */
export function desiredRatePerWeek(
  trendWeight: number,
  goalWeight: number | null,
  unit: WeightUnit
): number {
  if (goalWeight == null) {
    return 0;
  }
  const toGo = goalWeight - trendWeight;
  if (Math.abs(toGo) <= AT_GOAL_TOLERANCE[unit]) {
    return 0;
  }
  if (toGo < 0) {
    const [lo, hi] = CUT_RATE_BOUNDS[unit];
    return -Math.min(hi, Math.max(lo, trendWeight * CUT_RATE_PCT));
  }
  const [lo, hi] = GAIN_RATE_BOUNDS[unit];
  return Math.min(hi, Math.max(lo, trendWeight * GAIN_RATE_PCT));
}

/**
 * The engine's data half: EMA weight trend + fully-logged intake window →
 * observed daily expenditure, behind all the honesty gates (fresh weigh-ins,
 * ≥4 spread across the window, ≥10 fully-logged days, plausible result).
 * Shared by computeAdaptiveTarget and the Phase 2 target recommendation.
 */
export function observedEnergyBalance(inputs: {
  weighIns: AdaptiveWeighIn[];
  intakeDays: AdaptiveIntakeDay[];
  nowMs: number;
}): ObservedEnergyBalanceResult {
  // --- the weight side: EMA trend + observed rate over the window ---
  const { unit, points } = normalize(inputs.weighIns);
  const rows = ema(points);
  const last = rows.at(-1);
  if (!last) {
    return { kind: "insufficient", reason: "few_weighins" };
  }
  if (inputs.nowMs - last.t > MAX_WEIGHIN_AGE_DAYS * MS_PER_DAY) {
    return { kind: "insufficient", reason: "stale_weighins" };
  }
  const windowRows = withinDays(rows, WINDOW_DAYS);
  if (
    windowRows.length < MIN_WINDOW_WEIGHINS ||
    windowRows[windowRows.length - 1].t - windowRows[0].t <
      (WINDOW_DAYS - 4) * MS_PER_DAY
  ) {
    // Too few points, or they cluster inside a few days: no honest rate.
    return { kind: "insufficient", reason: "few_weighins" };
  }
  const observedRate = ratePerWeek(windowRows);

  // --- the intake side: average over the fully-logged window days ---
  const windowStart = inputs.nowMs - WINDOW_DAYS * MS_PER_DAY;
  const logged = inputs.intakeDays.filter(
    (d) =>
      d.t >= windowStart &&
      d.t < inputs.nowMs &&
      d.calories >= LOGGED_DAY_MIN_KCAL
  );
  if (logged.length < MIN_LOGGED_DAYS) {
    return { kind: "insufficient", reason: "few_logged_days" };
  }
  const avgIntake = Math.round(
    logged.reduce((s, d) => s + d.calories, 0) / logged.length
  );

  // --- energy balance: expenditure = intake - (rate in kcal/day) ---
  const expenditure = Math.round(
    avgIntake - (observedRate * KCAL_PER_UNIT[unit]) / 7
  );
  if (expenditure < MIN_EXPENDITURE || expenditure > MAX_EXPENDITURE) {
    // The window says something impossible (usually silent under-logging);
    // recommending from it would bake the lie into the targets.
    return { kind: "insufficient", reason: "implausible_expenditure" };
  }

  return {
    kind: "ok",
    unit,
    expenditure,
    avgIntake,
    loggedDays: logged.length,
    observedRate,
    trendWeight: last.trend,
  };
}

/**
 * Re-derive macro grams for a new calorie total: protein stays anchored,
 * carbs/fat absorb the change in their existing ratio. Null macros when the
 * member has no complete macro set (then only the calorie number changes).
 */
export function rebalanceMacros(
  calories: number,
  target: {
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  } | null
): { protein: number | null; carbs: number | null; fat: number | null } {
  if (
    !target ||
    target.protein == null ||
    target.carbs == null ||
    target.fat == null
  ) {
    return { protein: null, carbs: null, fat: null };
  }
  const protein = target.protein;
  const proteinKcal = protein * KCAL_PER_GRAM.protein;
  const remaining = Math.max(0, calories - proteinKcal);
  const carbsKcal = target.carbs * KCAL_PER_GRAM.carbs;
  const fatKcal = target.fat * KCAL_PER_GRAM.fat;
  const nonProtein = carbsKcal + fatKcal;
  const carbsShare = nonProtein > 0 ? carbsKcal / nonProtein : 0.55;
  return {
    protein,
    carbs: Math.round((remaining * carbsShare) / KCAL_PER_GRAM.carbs),
    fat: Math.round((remaining * (1 - carbsShare)) / KCAL_PER_GRAM.fat),
  };
}

/**
 * Observed expenditure + desired pace → the daily target (and rebalanced
 * macros) this engine stands behind. With a current target the move is
 * clamped to ±MAX_STEP_KCAL (gentle weekly nudges); with none (day 0, the
 * Phase 2 recommendation) the ideal is recommended directly. One
 * implementation shared by computeAdaptiveTarget and the target
 * recommendation so the two surfaces can never disagree.
 */
export function deriveTargetFromExpenditure(args: {
  expenditure: number;
  /** Signed units/week; 0 = maintenance. */
  desiredRate: number;
  unit: WeightUnit;
  /** Null = no current target: no step clamp. */
  currentCalories: number | null;
  /** Current macro targets; a complete set is re-derived protein-anchored. */
  target: {
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  } | null;
}): {
  calories: number;
  /** True when the calorie floor overrode the arithmetic. */
  floored: boolean;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
} {
  const ideal =
    args.expenditure + (args.desiredRate * KCAL_PER_UNIT[args.unit]) / 7;
  // Gentle nudge: clamp to a max step from the current target, then floor.
  const stepped =
    args.currentCalories == null
      ? ideal
      : Math.min(
          args.currentCalories + MAX_STEP_KCAL,
          Math.max(args.currentCalories - MAX_STEP_KCAL, ideal)
        );
  const calories = Math.max(CALORIE_FLOOR, round25(stepped));
  return {
    calories,
    floored: calories > round25(stepped),
    ...rebalanceMacros(calories, args.target),
  };
}

export function computeAdaptiveTarget(
  inputs: AdaptiveTargetInputs
): AdaptiveResult {
  const currentCalories = inputs.target?.calories ?? null;
  if (currentCalories == null) {
    // Nothing to adapt: adaptive targets nudge an existing number, they don't
    // invent the first one (that's the plan builder / target editor's job).
    return { kind: "insufficient", reason: "no_calorie_target" };
  }

  const observed = observedEnergyBalance(inputs);
  if (observed.kind !== "ok") {
    return observed;
  }
  const { unit, expenditure, avgIntake, loggedDays, observedRate, trendWeight } =
    observed;

  const desiredRate = desiredRatePerWeek(trendWeight, inputs.goalWeight, unit);
  const derived = deriveTargetFromExpenditure({
    expenditure,
    desiredRate,
    unit,
    currentCalories,
    target: inputs.target,
  });
  const deltaCalories = derived.calories - currentCalories;
  if (Math.abs(deltaCalories) < MIN_DELTA_KCAL) {
    return { kind: "hold", reason: "delta_too_small" };
  }

  return {
    kind: "recommend",
    unit,
    expenditure,
    avgIntake,
    loggedDays,
    observedRate: round1(observedRate),
    desiredRate: round1(desiredRate),
    trendWeight,
    currentCalories,
    calories: derived.calories,
    deltaCalories,
    protein: derived.protein,
    carbs: derived.carbs,
    fat: derived.fat,
  };
}
