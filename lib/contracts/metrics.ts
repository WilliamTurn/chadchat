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
 * OWNER APPROVAL: this registry and the data-state model are the two Phase 1
 * artifacts the owner reviews and approves before later phases lock onto
 * them. Definition changes after approval are product decisions, not
 * refactors.
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

import type { ClaimKind } from "./claims";
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
  | { kind: "goal"; source: string };

export type MetricDef = {
  domain: DomainId;
  /** Member-facing label (canonical; cards use this, not a rephrasing). */
  label: string;
  /** Display unit. Storage unit noted when different. */
  unit: UnitId;
  storageUnit?: UnitId;
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
      "Sum over meals with recordedAt/createdAt inside the member-local today window (todayStartInTz). No meals logged = unlogged, never 0 kcal. Phase 2 rewiring note: live cards currently inline-reduce (app/today/page.tsx, app/nutrition/page.tsx); rewire them to this symbol. CAUTION: lib/nutrition/macros.ts exports a DIFFERENT sumMacros (meal-plan domain, other signature); this metric's source is lib/ai/dashboard.ts only.",
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
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/nutrition"],
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
      "Sunday-start member-local week from getWaterDailyTotals; unlogged days are hollow slots, never 0-height bars.",
    target: { kind: "user-setting", source: "User.waterGoalMl" },
    allowedClaims: ["current-value", "adherence", "trend-direction"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/hydration"],
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
      "Sunday-start member-local week from getSleepDailyTotals; missing nights render as gaps, never as 0h.",
    target: { kind: "user-setting", source: "User.sleepGoalMinutes" },
    allowedClaims: ["current-value", "adherence", "trend-direction"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/sleep"],
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
    surfaces: ["/today", "/progress"],
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
    surfaces: ["/today", "/progress", "/goals", "/reports"],
  },
  "body.weight.ratePerWeek": {
    domain: "body",
    label: "Weekly rate",
    unit: "lb",
    grain: "week",
    source: { module: "lib/chart/trend.ts", symbol: "ratePerWeek" },
    target: { kind: "none" },
    allowedClaims: ["rate"],
    estimated: true,
    staleAfterDays: 10,
    access: "pro",
    precision: 1,
    surfaces: ["/progress"],
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
    surfaces: ["/progress"],
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
    surfaces: ["/progress"],
  },

  /* -------------------------------------------------------------- goals */
  "goal.progress.pct": {
    domain: "goals",
    label: "Progress to goal",
    unit: "percent",
    grain: "instant",
    source: { module: "lib/goals/progress.ts", symbol: "computeGoalProgress" },
    derivation:
      "Anchored on the goal's stored startValue (DSH-26); `current` is trend weight for weight goals (LC-4). Reached/overshoot verdicts come ONLY from lib/contracts/claims.ts goalStanding (DSH-62), never from toGo == 0. The live GoalProgress.reached field (pct >= 100 after rounding/clamping) is DEPRECATED and removed in the DSH-62 implementation: it can read reached while goalStanding says not (e.g. 180.06 vs a 180 target rounds pct to 100). Display rule: show 100% only when goalStanding === reached; otherwise cap the displayed pct at 99.",
    target: { kind: "goal", source: "Goal.targetValue" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: null,
    access: "member",
    precision: 0,
    surfaces: ["/today", "/progress", "/goals", "/goals/[id]"],
  },

  /* ----------------------------------------------------------- training */
  "training.session.volume": {
    domain: "training",
    label: "Volume",
    unit: "lb",
    grain: "session",
    source: { module: "lib/workouts/stats.ts", symbol: "workoutVolumeLb" },
    derivation:
      "Sum of weight x reps over completed working sets (warmups excluded); mixed units normalized to lb.",
    target: { kind: "none" },
    allowedClaims: ["current-value", "comparison"],
    estimated: false,
    staleAfterDays: null,
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
      "CONTRACT grain is the member-local day, but the pinned source currently buckets by UTC day (its doc says so). That matches noon-UTC-anchored picked days exactly and only drifts for logged-now sessions near local midnight. Moving volumeTrend to calendarDayAnchorInTz bucketing (like buildWorkoutWeek) is a Phase 2 task.",
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
      "Epley estimate over completed working sets, normalized to lb. Always labeled est.; formula named at detail level.",
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
    derivation:
      "One record per exercise across history; PR counts per workout replay history oldest-first (first-ever session is a baseline, not a record).",
    target: { kind: "none" },
    allowedClaims: ["current-value", "record"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/workouts"],
  },
  "training.sessions.thisWeek": {
    domain: "training",
    label: "Sessions this week",
    unit: "count",
    grain: "week",
    source: { module: "lib/today/week.ts", symbol: "buildWorkoutWeek" },
    target: { kind: "none" },
    allowedClaims: ["current-value", "comparison"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today", "/workouts"],
  },

  /* --------------------------------------------------------- engagement */
  "engagement.streak.days": {
    domain: "engagement",
    label: "Streak",
    unit: "days",
    grain: "user-day",
    source: { module: "app/today/page.tsx", symbol: "computeStreak" },
    derivation:
      "Consecutive member-local days ending today or yesterday with any logged action (meal, workout, water, weigh-in, sleep). Extraction into a pure lib module is a Phase 2 task; the definition is pinned here now.",
    target: { kind: "none" },
    allowedClaims: ["current-value"],
    estimated: false,
    staleAfterDays: null,
    access: "pro",
    precision: 0,
    surfaces: ["/today"],
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
} as const satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRICS;

/** All metrics of one domain, for Progress/report assembly in later phases. */
export function metricsForDomain(domain: DomainId): MetricId[] {
  return (Object.keys(METRICS) as MetricId[]).filter(
    (id) => METRICS[id].domain === domain
  );
}
