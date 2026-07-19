/**
 * METRIC REGISTRY (DSH-66 / Phase 1). The single typed list of every number
 * the dashboard shows. For each metric: where the value comes from, what unit
 * it carries, what time grain it lives on, how its target is defined, and
 * which derived claims are ever allowed on it.
 *
 * The rule this exists to enforce: A DISPLAYED NUMBER IS A REGISTERED METRIC,
 * COMPUTED IN EXACTLY ONE MODULE. Two cards showing "the same" number two
 * different ways (the DSH-26 / DSH-62 class of bug) becomes structurally
 * impossible when both cards render the same registered metric through the
 * same source function and the same formatter.
 *
 * Phase 1 status: documentation-as-code. The registry describes and pins the
 * computations that already exist in pure modules (lib/chart/trend.ts,
 * lib/workouts/stats.ts, lib/goals/progress.ts, lib/today/week.ts). It does
 * not re-implement them, and no live card is rewired yet (Phase 2+). The
 * contract unit tests verify every `source` module exists on disk and that
 * the named symbol appears in its source text.
 *
 * OWNER-APPROVED 2026-07-12 (s185), together with the data-state model.
 * Later phases lock onto these definitions. Changing a definition from here
 * on is a product decision recorded in the program tracker's decision log,
 * never a refactor. (The two rename proposals in routes.ts remain pending
 * Phase 3 owner decisions; they were NOT part of this approval.)
 *
 * Time grain primer (FEAT-8, already built; do not rebuild):
 *   - "user-day"  = the member's own calendar day via lib/date.ts *InTz
 *                   helpers keyed off user.timezone. Every daily bucket and
 *                   "today" query uses these. A late-night log belongs to the
 *                   member's today, never the UTC day.
 *   - "instant"   = a raw timestamp (logged-now rows).
 *   - "night"     = one sleep entry per member-local night.
 *   - "session"   = one workout.
 *   - "week"      = the member's Sunday-start calendar week (lib/today/week.ts).
 */

import { canClaim, type ClaimKind } from "./claims";
import type { ClaimVerdict } from "./claims";
import type { Coverage } from "./data-state";
import type { DomainId, RouteId } from "./routes";
import type { UnitId } from "./units";

export type TimeGrain = "user-day" | "instant" | "night" | "session" | "week";

/** How a metric's target is defined (targets are never invented per card). */
export type TargetDef =
  | { kind: "none" }
  | {
      kind: "user-target";
      /** Where the target lives. */
      source: string;
      /** Resolution rule when several candidate targets exist. */
      resolution?: string;
    }
  | { kind: "user-setting"; source: string; default?: string }
  | { kind: "goal"; source: string }
  | {
      /** Derived from a structured plan (FIX-28, P4); until the plan schema
       *  ships, no target renders for the metric. */
      kind: "plan";
      source: string;
    };

/**
 * Default window (member-local days) that coverage, sparse verdicts, and
 * claim checks are evaluated over, per grain. EVERY surface evaluates a
 * given metric over the SAME window (a per-metric `coverageWindowDays`
 * overrides), so two pages can never disagree about whether the same claim
 * is allowed. Day/night/week grains evaluate over the current week; slow
 * outcome metrics (weigh-ins, sessions) evaluate over 28 days.
 */
export const COVERAGE_WINDOW_BY_GRAIN: Record<TimeGrain, number> = {
  "user-day": 7,
  night: 7,
  week: 7,
  instant: 28,
  session: 28,
};

/** The evaluation window for a metric (override, else its grain default). */
export function coverageWindowDays(id: MetricId): number {
  // Widen: the as-const union only carries optional fields where declared.
  const def: MetricDef = METRICS[id];
  return def.coverageWindowDays ?? COVERAGE_WINDOW_BY_GRAIN[def.grain];
}

export type MetricDef = {
  domain: DomainId;
  /** Member-facing label (canonical; cards use this, not a rephrasing). */
  label: string;
  /**
   * DEFAULT display unit, resolved per member where a preference exists:
   * weight metrics render in User.weightUnit (kg members see kg via
   * lib/contracts/units.ts conversions); the lb declared here is the
   * default, not a constraint.
   */
  unit: UnitId;
  storageUnit?: UnitId;
  /**
   * How the absence of rows renders. Default "not-logged" (missing is never
   * zero). "zero" is the carve-out for counts of logged events (sessions,
   * meals-logged count, PRs), where zero is a truthful observed value; see
   * lib/contracts/data-state.ts.
   */
  missingRendersAs?: "not-logged" | "zero";
  /** Override of COVERAGE_WINDOW_BY_GRAIN for this metric (member-local days). */
  coverageWindowDays?: number;
  grain: TimeGrain;
  /** The one module + symbol that computes this value. */
  source: { module: string; symbol: string };
  /** Extra derivation facts a consumer must not re-decide. */
  derivation?: string;
  target: TargetDef;
  /**
   * Claims that may EVER be made from this metric (still subject to the
   * coverage thresholds in lib/contracts/claims.ts). A claim kind absent
   * here is forbidden for this metric at any coverage.
   */
  allowedClaims: readonly ClaimKind[];
  /** Derived/estimated values must be labeled at display time. */
  estimated: boolean;
  /**
   * Member-local days after which the value is stale and must be shown dated
   * rather than framed as current. null = never stale (historical series).
   */
  staleAfterDays: number | null;
  /** Minimum tier that may see this metric (admin is always comped). */
  access: "member" | "pro" | "elite";
  /** Display precision (fraction digits). */
  precision: 0 | 1;
  /** Registered routes where this metric renders today. */
  surfaces: readonly RouteId[];
};

export const METRICS = {
  /* ---------------------------------------------------------- nutrition */
  "nutrition.calories.today": {
    domain: "nutrition",
    label: "Calories today",
    unit: "kcal",
    grain: "user-day",
    source: { module: "lib/ai/dashboard.ts", symbol: "sumMacros" },
    derivation:
      "Sum over meals with recordedAt/createdAt inside the member-local today window (todayStartInTz). No meals logged = unlogged, never 0 kcal. Rewiring status (P56-Z): /today reads it through lib/today/panel-data.ts + lib/today/week.ts (buildMacroWeek/dailyMacroTrend over the same member-local day windows); app/nutrition/page.tsx still inline-reduces (sumMacro) and remains the LAST unrewired reader, queued in MTL; values agree today, the one-module structure is the open debt. CAUTION: lib/nutrition/macros.ts exports a DIFFERENT sumMacros (meal-plan domain, other signature); this metric's source is lib/ai/dashboard.ts only.",
    target: {
      kind: "user-target",
      source: "NutritionTarget.calories (lib/db/queries.getNutritionTarget)",
      resolution:
        "LC-2: the live daily target wins; the meal plan's stored snapshot (MealPlan.targetCalories) is the fallback only when no daily target is set. One plan, one set of numbers, on every screen.",
    },
    allowedClaims: ["current-value", "adherence", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/nutrition", "/reports"],
  },
  "nutrition.protein.today": {
    domain: "nutrition",
    label: "Protein today",
    unit: "g",
    grain: "user-day",
    source: { module: "lib/ai/dashboard.ts", symbol: "sumMacros" },
    derivation:
      "Same Phase 2 rewiring note and macros.ts caution as nutrition.calories.today.",
    target: {
      kind: "user-target",
      source: "NutritionTarget.protein",
      resolution: "Same LC-2 resolution as calories.",
    },
    allowedClaims: ["current-value", "adherence", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/nutrition", "/reports"],
  },
  "nutrition.carbs.today": {
    domain: "nutrition",
    label: "Carbs today",
    unit: "g",
    grain: "user-day",
    source: { module: "lib/ai/dashboard.ts", symbol: "sumMacros" },
    derivation:
      "Same Phase 2 rewiring note and macros.ts caution as nutrition.calories.today.",
    target: { kind: "user-target", source: "NutritionTarget.carbs" },
    allowedClaims: ["current-value", "adherence"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/nutrition"],
  },
  "nutrition.fat.today": {
    domain: "nutrition",
    label: "Fat today",
    unit: "g",
    grain: "user-day",
    source: { module: "lib/ai/dashboard.ts", symbol: "sumMacros" },
    derivation:
      "Same Phase 2 rewiring note and macros.ts caution as nutrition.calories.today.",
    target: { kind: "user-target", source: "NutritionTarget.fat" },
    allowedClaims: ["current-value", "adherence"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/nutrition"],
  },
  "nutrition.meals.today": {
    domain: "nutrition",
    label: "Meals logged today",
    unit: "count",
    grain: "user-day",
    source: { module: "lib/db/queries.ts", symbol: "getMealsSince" },
    missingRendersAs: "zero",
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/nutrition"],
  },
  "nutrition.week.daily": {
    domain: "nutrition",
    label: "This week",
    unit: "kcal",
    grain: "week",
    source: { module: "lib/today/week.ts", symbol: "buildMacroWeek" },
    derivation:
      "Sunday-start member-local week over dailyMacroTrend day totals (lib/nutrition/daily-macros.ts); unlogged days are hollow slots, never 0-kcal bars. Registered P5 (P56-C batch-register, README list: weekly nutrition adherence cue). Per-day target basis is the FIX-07 effective-dated nutrition target (lib/db/queries.getNutritionTargetsByDay): each day grades against the target active on THAT day, never the current pointer.",
    target: {
      kind: "user-target",
      source:
        "NutritionTargetVersion via getNutritionTargetsByDay (FIX-07); zero versions fall back to the live NutritionTarget row (pre-FIX-07 behavior).",
    },
    allowedClaims: ["current-value", "adherence", "trend-direction"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/nutrition"],
  },
  "nutrition.adherence.window": {
    domain: "nutrition",
    label: "Days within calorie target",
    unit: "count",
    grain: "user-day",
    source: {
      module: "lib/progress/overview.ts",
      symbol: "nutritionAdherenceWindow",
    },
    missingRendersAs: "zero",
    derivation:
      "P56-A batch-register (README P5 list: weekly nutrition adherence). Over the Progress overview's selected window: logged days whose calorie total lands within CALORIE_TOLERANCE (10%) of THAT day's effective-dated target (FIX-07, getNutritionTargetsByDay); denominator = logged gradable days, never window days (LC-9). Days with no target that day are logged-but-not-gradable, never missed.",
    target: {
      kind: "user-target",
      source:
        "NutritionTargetVersion via getNutritionTargetsByDay (FIX-07), per day.",
    },
    allowedClaims: ["current-value", "adherence"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/progress"],
  },

  /* ---- energy (calories-burned Phase 1, owner rulings 2026-07-18) ----
     Registered ahead of their surfaces (Phase 2 wires the target
     recommendation, Phase 3 the exercise line + workout-card estimates),
     per the plan's registry-first rule: the computations exist and are
     unit-tested in lib/energy/* now; `surfaces` stays empty until a phase
     actually renders the number. All four are formula estimates
     (estimated: true — labeled estimated at display time). */
  "energy.recommendedTarget": {
    domain: "nutrition",
    label: "Recommended calorie target",
    unit: "kcal",
    grain: "instant",
    source: { module: "lib/energy/tdee.ts", symbol: "recommendedTarget" },
    derivation:
      "Mifflin-St Jeor BMR × everyday-life activity multiplier (User.activityLevel, workouts EXCLUDED — MFP semantics) ± the goal rate as kcal/day (3500 kcal/lb or 7700 kcal/kg per week ÷ 7), rounded to 25, floored at 1500 (male) / 1200 (female). Body weight = latest ProgressEntry weigh-in, never a second storage place. PRECEDENCE (plan §4.1): once lib/nutrition/adaptive-target.ts clears its own data gate its observed expenditure OUTRANKS this formula in recommendations; this is the day-0/no-data fallback. Proposes only — all target writes flow through the existing consent rails (D4), never silently.",
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: true,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: [],
  },
  "energy.maintenance.kcalPerDay": {
    domain: "nutrition",
    label: "Maintenance calories",
    unit: "kcal",
    grain: "instant",
    source: { module: "lib/energy/tdee.ts", symbol: "maintenanceKcal" },
    derivation:
      "TDEE: Mifflin-St Jeor BMR × activity multiplier (sedentary 1.2 | light 1.375 | moderate 1.55 | very 1.725). Shown inside the Phase 2 recommendation block ('Maintenance ~2,600'); same precedence note as energy.recommendedTarget.",
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: true,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: [],
  },
  "energy.workout.kcal": {
    domain: "training",
    label: "Exercise calories",
    unit: "kcal",
    grain: "session",
    source: {
      module: "lib/energy/workout-energy.ts",
      symbol: "workoutNetKcal",
    },
    derivation:
      "Net METs (D3, Cronometer's arithmetic): (MET − 1) × kg × hours, never gross. Strength sessions use Workout.durationSeconds at MET 3.5 ('general lifting', D5) or the intense variant (6.0); sets/reps/RPE are never calorie inputs (the MFP position). Cardio uses minutes against lib/energy/activity-catalog.ts (2024 Compendium). Body weight = latest weigh-in. Missing inputs → null, never a guess. Phase 3 renders it on workout cards/history ('~225 cal estimated').",
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: true,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: [],
  },
  "energy.exercise.kcalPerDay": {
    domain: "nutrition",
    label: "Exercise calories today",
    unit: "kcal",
    grain: "user-day",
    source: {
      module: "lib/energy/workout-energy.ts",
      symbol: "exerciseKcalForDay",
    },
    derivation:
      "Sum of the member-local day's computable per-session estimates (energy.workout.kcal); sessions with missing inputs contribute nothing, a day with no computable session is null (not-logged, never 0). Computed at read time from workout rows + catalog + latest weight — no denormalized burn column (one-canonical-value rule, plan §6). Phase 3 adds the Exercise line to the day's calorie math (Remaining = Target − Food + Exercise) when User.exerciseCalorieAddBack is on (D2, default true).",
    target: { kind: "none" },
    allowedClaims: ["current-value", "comparison"],
    estimated: true,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: [],
  },

  /* ---------------------------------------------------------- hydration */
  "hydration.water.today": {
    domain: "hydration",
    label: "Water today",
    unit: "oz",
    storageUnit: "ml",
    grain: "user-day",
    source: { module: "lib/db/queries.ts", symbol: "getWaterMlSince" },
    derivation:
      "Stored in ml (WaterLog.amountMl); displayed in US fluid ounces via lib/today/water-units.ts. Members never see ml.",
    target: {
      kind: "user-setting",
      source: "User.waterGoalMl",
      default: "DEFAULT_WATER_GOAL_ML (one US gallon, 3785 ml)",
    },
    allowedClaims: ["current-value", "adherence", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/hydration"],
  },
  "hydration.week.daily": {
    domain: "hydration",
    label: "This week",
    unit: "oz",
    storageUnit: "ml",
    grain: "week",
    source: { module: "lib/today/week.ts", symbol: "buildWaterWeek" },
    derivation:
      "Sunday-start member-local week from getWaterDailyTotals; unlogged days are hollow slots, never 0-height bars. Per-day goal basis (P5, FIX-07 landed): the effective-dated goal via getWaterGoalMlByDay, so a backfilled day grades against the goal active on that day, never the current pointer.",
    target: { kind: "user-setting", source: "User.waterGoalMl" },
    allowedClaims: ["current-value", "adherence", "trend-direction"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/hydration"],
  },
  "hydration.avg.window": {
    domain: "hydration",
    label: "Average per logged day",
    unit: "oz",
    storageUnit: "ml",
    grain: "user-day",
    source: { module: "lib/progress/overview.ts", symbol: "hydrationWindow" },
    derivation:
      "P56-A batch-register (README P5 list: hydration consistency summary). Mean daily intake over LOGGED days in the Progress overview's selected window (LC-9 denominator); unlogged days never count as zeros. Stored ml, displayed oz (lib/today/water-units.ts).",
    target: { kind: "user-setting", source: "User.waterGoalMl" },
    allowedClaims: ["current-value", "adherence"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/progress"],
  },
  "hydration.daysAtGoal.window": {
    domain: "hydration",
    label: "Days at goal",
    unit: "count",
    grain: "user-day",
    source: { module: "lib/progress/overview.ts", symbol: "hydrationWindow" },
    missingRendersAs: "zero",
    derivation:
      "P56-A batch-register. Logged days in the overview window meeting THAT day's effective-dated goal (FIX-07, getWaterGoalMlByDay); denominator = logged days (LC-9).",
    target: { kind: "user-setting", source: "User.waterGoalMl" },
    allowedClaims: ["current-value", "adherence"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/progress"],
  },

  /* -------------------------------------------------------------- sleep */
  "sleep.lastNight.duration": {
    domain: "sleep",
    label: "Last night",
    unit: "duration",
    storageUnit: "minutes",
    grain: "night",
    source: { module: "lib/today/week.ts", symbol: "buildLastNight" },
    derivation:
      "The latest SleepEntry. isCurrent only when the entry is for today or yesterday; older entries are shown DATED (P1-2), never framed as last night.",
    target: { kind: "user-setting", source: "User.sleepGoalMinutes" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: 1,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/sleep"],
  },
  "sleep.lastNight.quality": {
    domain: "sleep",
    label: "Sleep quality",
    unit: "score5",
    grain: "night",
    source: { module: "lib/today/week.ts", symbol: "buildLastNight" },
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: 1,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/sleep"],
  },
  "sleep.week.nightly": {
    domain: "sleep",
    label: "This week",
    unit: "duration",
    storageUnit: "minutes",
    grain: "week",
    source: { module: "lib/today/week.ts", symbol: "buildSleepWeek" },
    derivation:
      "Sunday-start member-local week from getSleepDailyTotals; missing nights render as gaps, never as 0h. Per-night goal basis (P5, FIX-07 landed): the effective-dated goal via getSleepGoalMinutesByDay, so a backfilled night grades against the goal active on that night, never the current pointer.",
    target: { kind: "user-setting", source: "User.sleepGoalMinutes" },
    allowedClaims: ["current-value", "adherence", "trend-direction"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/sleep"],
  },
  "sleep.avg.window": {
    domain: "sleep",
    label: "Average sleep",
    unit: "duration",
    storageUnit: "minutes",
    grain: "night",
    source: { module: "lib/progress/overview.ts", symbol: "sleepWindow" },
    derivation:
      "P56-A batch-register (README P5 list: sleep consistency summary). Mean nightly duration over LOGGED nights in the Progress overview's selected window (LC-9); missing nights are never zeros.",
    target: { kind: "user-setting", source: "User.sleepGoalMinutes" },
    allowedClaims: ["current-value", "adherence"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/progress"],
  },
  "sleep.nightsAtGoal.window": {
    domain: "sleep",
    label: "Nights at goal",
    unit: "count",
    grain: "night",
    source: { module: "lib/progress/overview.ts", symbol: "sleepWindow" },
    missingRendersAs: "zero",
    derivation:
      "P56-A batch-register. Logged nights in the overview window meeting THAT night's effective-dated goal (FIX-07, getSleepGoalMinutesByDay); denominator = logged nights (LC-9).",
    target: { kind: "user-setting", source: "User.sleepGoalMinutes" },
    allowedClaims: ["current-value", "adherence"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/progress"],
  },

  /* --------------------------------------------------------------- body */
  "body.weight.scale": {
    domain: "body",
    label: "Scale weight",
    unit: "lb",
    grain: "instant",
    source: {
      module: "lib/db/queries.ts",
      symbol: "getProgressEntriesByUserId",
    },
    derivation:
      "Latest ProgressEntry.weight in the member's display unit (User.weightUnit, else the latest entry's unit). Shown labeled NEXT TO trend weight, never as the headline current weight.",
    target: { kind: "goal", source: "Goal (metric=weight) targetValue" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: 10,
    access: "pro",
    precision: 1,
    surfaces: ["/today", "/progress/body"],
  },
  "body.weight.trend": {
    domain: "body",
    label: "Trend weight",
    unit: "lb",
    grain: "instant",
    source: { module: "lib/chart/trend.ts", symbol: "ema" },
    derivation:
      "Gap-aware EMA (tau=10) over weigh-ins. THE canonical current weight (LC-4): every surface headlines this value; %, to-go, and since-start derive from it.",
    target: { kind: "goal", source: "Goal (metric=weight) targetValue" },
    allowedClaims: ["current-value", "trend-direction", "rate", "eta"],
    estimated: true,
    staleAfterDays: 10,
    access: "pro",
    precision: 1,
    surfaces: ["/today", "/progress", "/progress/body", "/goals", "/reports"],
  },
  "body.weight.ratePerWeek": {
    domain: "body",
    label: "Weekly rate",
    unit: "lb",
    grain: "week",
    source: { module: "lib/chart/trend.ts", symbol: "ratePerWeek" },
    derivation:
      "The quantity is lb PER WEEK; display appends the period outside the unit system ('-0.8 lb / week'). The shared chart formatter owns this form in Phase 2.",
    target: { kind: "none" },
    allowedClaims: ["rate"],
    estimated: true,
    staleAfterDays: 10,
    access: "pro",
    precision: 1,
    surfaces: ["/progress/body"],
  },
  "body.weight.eta": {
    domain: "body",
    label: "Projected goal date",
    unit: "days",
    grain: "instant",
    source: { module: "lib/chart/trend.ts", symbol: "projectToGoal" },
    derivation:
      "Linear projection; returns null (renders nothing) when the goal is met, the rate is negligible, or the trend moves away. Always labeled an estimate. Canonical rendering is the projected DATE (formatCalendarDay of dateMs, e.g. 'Sep 12 (estimate)'); the days quantity is the underlying value, not the display form.",
    target: { kind: "goal", source: "Goal (metric=weight) targetValue" },
    allowedClaims: ["eta"],
    estimated: true,
    staleAfterDays: 10,
    access: "pro",
    precision: 0,
    surfaces: ["/progress/body"],
  },
  "body.measurement": {
    domain: "body",
    label: "Body measurement",
    unit: "in",
    grain: "instant",
    source: {
      module: "lib/db/queries.ts",
      symbol: "getBodyMeasurementsByUserId",
    },
    target: { kind: "none" },
    allowedClaims: ["current-value", "trend-direction"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 1,
    surfaces: ["/progress/body"],
  },

  /* -------------------------------------------------------------- goals */
  "goal.progress.pct": {
    domain: "goals",
    label: "Progress to goal",
    unit: "percent",
    grain: "instant",
    source: { module: "lib/goals/progress.ts", symbol: "computeGoalProgress" },
    derivation:
      "Anchored on the goal's stored startValue (DSH-26); `current` is trend weight for weight goals (LC-4). Reached/overshoot verdicts come ONLY from lib/contracts/claims.ts goalStanding (DSH-62), never from toGo == 0. The live GoalProgress.reached field (pct >= 100 after rounding/clamping) is DEPRECATED and removed in the DSH-62 implementation: it can read reached while goalStanding says not (e.g. 180.06 vs a 180 target rounds pct to 100). Display rule: show 100% only when goalStanding === reached; otherwise cap the displayed pct at 99. Tier-locked outcome rule: when the goal's outcome metric is above the member's tier (a Basic member's weight goal reads Pro-only trend weight), the goal card shows the goal DEFINITION plus a locked-outcome note naming the capability and tier; state is the locked treatment for the outcome row, never fake progress, never an error tone.",
    target: { kind: "goal", source: "Goal.targetValue" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: null,
    access: "member",
    precision: 0,
    surfaces: ["/today", "/progress", "/progress/body", "/goals", "/goals/[id]"],
  },

  /* -------------------------------------------------------------- plans */
  "plans.mealSlice.today": {
    domain: "plans",
    label: "Next planned meal",
    unit: "kcal",
    grain: "user-day",
    source: { module: "lib/plans/meal-slice.ts", symbol: "mealSliceToday" },
    derivation:
      "Registered P5 (P56-E batch-register, README list: plan-slice numbers). Deterministic and inspectable, matching the training rotation's positional model: today's plan day = member-local days since the plan's creation day modulo plan length; the next meal = that day's meals in PLAN ORDER advanced by nutrition.meals.today (never re-sorted); every planned meal covered renders the explicit completed state, never a fabricated next meal. Calories/protein shown are the plan document's own designed totals (meal and day), never conflated with the member's live nutrition targets, which stay nutrition.* metrics.",
    target: {
      kind: "plan",
      source:
        "MealPlan.days[dayIndex].totals: the plan document's designed day.",
    },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today"],
  },

  /* ----------------------------------------------------------- training */
  "training.session.volume": {
    domain: "training",
    label: "Volume",
    unit: "lb",
    grain: "session",
    source: { module: "lib/workouts/stats.ts", symbol: "workoutVolumeLb" },
    derivation:
      "Sum of weight x reps over completed working sets (warmups excluded); mixed units normalized to lb. Past staleness the panel shows the session DATED ('Last workout Jun 28') plus a fresh-session prompt, never a months-old number framed as current.",
    target: { kind: "none" },
    allowedClaims: ["current-value", "comparison"],
    estimated: false,
    staleAfterDays: 14,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/workouts"],
  },
  "training.volume.dailyTrend": {
    domain: "training",
    label: "Training volume",
    unit: "lb",
    grain: "user-day",
    source: { module: "lib/workouts/stats.ts", symbol: "volumeTrend" },
    derivation:
      "Member-local day bucketing: pass user.timezone to volumeTrend (calendarDayAnchorInTz, implemented FIX-33/P56-B per the queued note here; the no-timezone call falls back to UTC-day bucketing for legacy callers). Computed over CANONICALIZED workouts so aliases merge.",
    target: { kind: "none" },
    allowedClaims: ["current-value", "trend-direction", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/workouts"],
  },
  "training.exercise.e1rm": {
    domain: "training",
    label: "est. 1RM",
    unit: "lb",
    grain: "session",
    source: { module: "lib/workouts/stats.ts", symbol: "exercise1RMTrend" },
    derivation:
      "Epley estimate over completed working sets, normalized to lb. Always labeled est.; formula named at detail level. CANONICALIZED INPUT (FIX-33/P56-Z): callers pass canonicalizeWorkouts output AND resolve the exercise ref through resolveExerciseIdentity with the member's ResolveOptions before matching, or an alias-spelled goal ref silently misses its merged history (buildGoalVM in lib/goals/outcome-values.ts does this; /goals and /goals/[id] mirror it).",
    target: { kind: "goal", source: "Goal (metric=lift) targetValue" },
    allowedClaims: [
      "current-value",
      "trend-direction",
      "strength-change",
      "record",
    ],
    estimated: true,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/workouts", "/goals"],
  },
  "training.prs": {
    domain: "training",
    label: "Personal records",
    unit: "count",
    grain: "session",
    source: {
      module: "lib/workouts/stats.ts",
      symbol: "computePersonalRecords",
    },
    missingRendersAs: "zero",
    derivation:
      "One record per exercise across history; PR counts per workout replay history oldest-first (first-ever session is a baseline, not a record).",
    target: { kind: "none" },
    allowedClaims: ["current-value", "record"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/workouts", "/progress"],
  },
  "training.sessions.thisWeek": {
    domain: "training",
    label: "Sessions this week",
    unit: "count",
    grain: "week",
    source: { module: "lib/today/week.ts", symbol: "buildWorkoutWeek" },
    missingRendersAs: "zero",
    target: {
      kind: "plan",
      source:
        "Structured training plan sessions/week (FIX-28, P4). Until the plan schema ships, no target renders ('2 sessions this week', not '2 of ?').",
    },
    allowedClaims: ["current-value", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/workouts", "/progress"],
  },
  /* FIX-33 batch registrations (P5, per the README P5 batch-register list):
     the Progress > Training analytics numbers. All computed over
     CANONICALIZED workouts (exercise identities resolved read-time, FIX-34)
     by lib/workouts/training-data.ts getTrainingAnalytics, the surface's one
     assembly. They render on the /progress/training category route
     (registered by P56-A per DEC-02). */
  "training.sessions.total": {
    domain: "training",
    label: "Workouts logged",
    unit: "count",
    grain: "session",
    source: {
      module: "lib/workouts/training-data.ts",
      symbol: "getWorkoutHeaders",
    },
    missingRendersAs: "zero",
    derivation:
      "All-time count of saved workouts from the UNCAPPED header query (rows.length), never from a page-capped hydration slice, so /workouts and /progress/training read the same true number past MAX_WORKOUTS (the P56-B pre-delivery P2-1 fix).",
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/workouts", "/progress/training"],
  },
  "training.volume.week": {
    domain: "training",
    label: "Volume this week",
    unit: "lb",
    grain: "week",
    source: {
      module: "lib/workouts/training-analytics.ts",
      symbol: "volumeSinceLb",
    },
    missingRendersAs: "zero",
    derivation:
      "Total weight x reps over completed working sets across the member-local current week (sinceDayMs = week start), member-local day attribution, canonicalized workouts. The one symbol behind the /workouts 'Volume this week' tile and the Progress > Training status band.",
    target: { kind: "none" },
    allowedClaims: ["current-value", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/workouts", "/progress/training"],
  },
  "training.frequency.weeklyTrend": {
    domain: "training",
    label: "Training frequency",
    unit: "count",
    grain: "week",
    source: {
      module: "lib/workouts/training-analytics.ts",
      symbol: "weeklyFrequencySlots",
    },
    missingRendersAs: "zero",
    derivation:
      "Sessions per trailing 7-day bin across the selected window; session days are member-local day anchors (calendarDayAnchorInTz). Zero-session weeks are truthful zero bars (count carve-out).",
    target: {
      kind: "plan",
      source: "Structured training plan sessions/week (rotation size, FIX-28).",
    },
    allowedClaims: ["current-value", "trend-direction", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/progress/training"],
  },
  "training.plan.completion.week": {
    domain: "training",
    label: "Plan sessions completed",
    unit: "count",
    grain: "week",
    source: { module: "lib/plans/adherence.ts", symbol: "weeklyPlanAdherence" },
    missingRendersAs: "zero",
    derivation:
      "Completions from the immutable PlanSessionCompletion event stream inside the member-local week vs the CURRENT rotation size (the shipped FIX-28 adherence model). NOT the same number as training.sessions.thisWeek: unplanned sessions count there but not here.",
    target: {
      kind: "plan",
      source: "Structured training plan sessions/week (rotation size, FIX-28).",
    },
    allowedClaims: ["current-value", "adherence", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/progress/training", "/plans/[id]"],
  },
  "training.plan.adherence.weeklyTrend": {
    domain: "training",
    label: "Plan adherence",
    unit: "count",
    grain: "week",
    source: {
      module: "lib/workouts/training-analytics.ts",
      symbol: "weeklyAdherenceSeries",
    },
    missingRendersAs: "zero",
    derivation:
      "Completed-vs-planned per member-local week, composing weeklyPlanAdherence per week (one adherence semantic, never re-derived).",
    target: {
      kind: "plan",
      source: "Structured training plan sessions/week (rotation size, FIX-28).",
    },
    allowedClaims: ["current-value", "adherence", "trend-direction"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/progress/training"],
  },
  "training.pr.timeline": {
    domain: "training",
    label: "Record timeline",
    unit: "lb",
    grain: "session",
    source: { module: "lib/workouts/stats.ts", symbol: "prEventsByWorkout" },
    missingRendersAs: "zero",
    derivation:
      "Every record-beating working set, replayed oldest-first over canonicalized history (first-ever sessions are baselines, not records; timed exercises never PR). prCountsByWorkout derives from these events, so history-card pills and the timeline can never disagree. Each event is source-linked to its workout. e1rm components render with the est. label per training.exercise.e1rm.",
    target: { kind: "none" },
    allowedClaims: ["current-value", "record"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/progress/training", "/workouts"],
  },
  "training.milestones.timeline": {
    domain: "training",
    label: "Training milestones",
    unit: "count",
    grain: "session",
    source: {
      module: "lib/workouts/training-analytics.ts",
      symbol: "mergeMilestoneTimeline",
    },
    missingRendersAs: "zero",
    derivation:
      "Reached milestones only, newest first: session-count thresholds (from the UNCAPPED workout-header query, truthful past the hydration cap) and perfect plan weeks (from the completion stream). Never projected; the next milestone ahead renders as explicit progress, never as an achievement.",
    target: { kind: "none" },
    allowedClaims: ["current-value", "record"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/progress/training"],
  },
  "training.muscle.distribution": {
    domain: "training",
    label: "Muscle focus",
    unit: "count",
    grain: "session",
    coverageWindowDays: 28,
    source: {
      module: "lib/workouts/training-analytics.ts",
      symbol: "muscleGroupDistribution",
    },
    missingRendersAs: "zero",
    derivation:
      "Completed working sets per muscle group over canonicalized history; rows without a group bucket under the explicit 'unspecified' share. The surface renders the distribution only when specified rows dominate (claims discipline at the call site).",
    target: { kind: "none" },
    allowedClaims: ["current-value", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/progress/training"],
  },

  /* --------------------------------------------------------- engagement */
  "engagement.streak.days": {
    domain: "engagement",
    label: "Streak",
    unit: "days",
    grain: "user-day",
    source: { module: "lib/today/streak.ts", symbol: "computeStreak" },
    derivation:
      "Consecutive member-local days ending today or yesterday with any logged action (meal, workout, water, weigh-in, sleep). Extracted to the pure lib module in P2-A (2026-07-12) exactly as pinned here; semantics unchanged.",
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/progress"],
  },
  "engagement.consistency.week": {
    domain: "engagement",
    label: "Logging consistency",
    unit: "days",
    grain: "week",
    source: { module: "lib/db/queries.ts", symbol: "getActivityDaysSince" },
    derivation:
      "Days this Sunday-start member-local week with at least one saved entry in any domain. Never called 'active days' (sounds like exercise).",
    target: { kind: "none" },
    allowedClaims: ["current-value", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today"],
  },
  "engagement.consistency.window": {
    domain: "engagement",
    label: "Days logged",
    unit: "count",
    grain: "user-day",
    coverageWindowDays: 84,
    source: { module: "lib/progress/overview.ts", symbol: "consistencyWindow" },
    missingRendersAs: "zero",
    derivation:
      "P56-A batch-register (README P5 list: consistency summary). Member-local days with at least one saved entry in ANY domain over the consistency calendar's fixed 12-week window (84 days); the per-day domain count powers the calendar's intensity scale. Distinct from the streak (consecutive days) and from the Sunday-week count.",
    target: { kind: "none" },
    allowedClaims: ["current-value", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/progress"],
  },
} as const satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRICS;

/** All metrics of one domain, for Progress/report assembly in later phases. */
export function metricsForDomain(domain: DomainId): MetricId[] {
  return (Object.keys(METRICS) as MetricId[]).filter(
    (id) => METRICS[id].domain === domain
  );
}

/**
 * The executable form of the per-metric claim allowlist: a claim kind absent
 * from a metric's `allowedClaims` is denied at ANY coverage, then the
 * coverage thresholds apply. Surfaces call THIS, not bare canClaim, when the
 * claim is about a registered metric.
 */
export function canClaimForMetric(
  id: MetricId,
  kind: ClaimKind,
  coverage: Coverage,
  opts?: Parameters<typeof canClaim>[2]
): ClaimVerdict {
  if (!(METRICS[id].allowedClaims as readonly ClaimKind[]).includes(kind)) {
    return {
      allowed: false,
      reason: `${id} never allows "${kind}" claims (metric registry).`,
    };
  }
  return canClaim(kind, coverage, opts);
}
