import { METRICS, type MetricId } from "@/lib/contracts/metrics";
import type { Goal, GoalOutcome } from "@/lib/db/schema";

/**
 * Goal-outcome resolution (FIX-29). Every goal resolves to a list of typed
 * outcome views: each outcome is either SUPPORTED (pinned to a registered
 * metric from lib/contracts/metrics.ts, the app's one outcome vocabulary) or
 * EXPLICITLY UNSUPPORTED (the app cannot measure it; the member maintains
 * `currentValue` by hand and surfaces say so, never pretending live data).
 *
 * Legacy goals (the single `Goal.metric` enum) are ADAPTED here at read
 * time; their rows are never rewritten. GoalOutcome rows, when present,
 * take precedence over the legacy columns.
 *
 * Pure module: no DB, no React.
 */

export type GoalOutcomeView = {
  /** GoalOutcome.id, or null when adapted from the legacy Goal columns. */
  id: string | null;
  position: number;
  /** True = pinned to a registered metric; false = explicitly unsupported. */
  supported: boolean;
  metricId: MetricId | null;
  /** The entity the metric refers to (exercise for e1rm), when needed. */
  metricRef: string | null;
  /** Member-facing outcome wording, always present. */
  label: string;
  startValue: number | null;
  targetValue: number | null;
  /**
   * Manual current value: meaningful ONLY for unsupported outcomes.
   * Supported outcomes read their metric's one source module (the
   * one-canonical-value law); consumers must not display this instead.
   */
  currentValue: number | null;
  unit: string | null;
  source: "outcome-row" | "legacy-goal";
};

export function isRegisteredMetricId(id: string): id is MetricId {
  return id in METRICS;
}

/**
 * The legacy Goal.metric vocabulary mapped onto the registry. `weight` goals
 * track trend weight (LC-4: the app's one canonical current weight), `lift`
 * goals track the named exercise's est. 1RM, `measurement` goals the named
 * body measurement. `bodyfat` and `custom` have no registered metric: they
 * are explicitly unsupported, tracked by hand.
 */
const LEGACY_METRIC_MAP: Record<
  NonNullable<Goal["metric"]>,
  { metricId: MetricId | null; fallbackLabel: string }
> = {
  weight: { metricId: "body.weight.trend", fallbackLabel: "Trend weight" },
  lift: { metricId: "training.exercise.e1rm", fallbackLabel: "est. 1RM" },
  measurement: { metricId: "body.measurement", fallbackLabel: "Body measurement" },
  bodyfat: { metricId: null, fallbackLabel: "Body fat %" },
  custom: { metricId: null, fallbackLabel: "Custom outcome" },
};

/** Display label for an outcome: explicit label, else registry label. */
function outcomeLabel(
  metricId: MetricId | null,
  metricRef: string | null,
  explicit: string | null,
  fallback: string
): string {
  if (explicit?.trim()) {
    return explicit.trim();
  }
  const base = metricId ? METRICS[metricId].label : fallback;
  return metricRef?.trim() ? `${metricRef.trim()} ${base}` : base;
}

/** Adapt the legacy single-metric Goal columns to an outcome view. */
export function legacyGoalOutcome(goal: Goal): GoalOutcomeView | null {
  if (!goal.metric) {
    return null;
  }
  const mapped = LEGACY_METRIC_MAP[goal.metric];
  return {
    id: null,
    position: 0,
    supported: mapped.metricId !== null,
    metricId: mapped.metricId,
    metricRef: goal.metricRef,
    label: outcomeLabel(
      mapped.metricId,
      goal.metricRef,
      null,
      mapped.fallbackLabel
    ),
    startValue: goal.startValue,
    targetValue: goal.targetValue,
    currentValue: mapped.metricId === null ? goal.currentValue : null,
    unit: goal.unit,
    source: "legacy-goal",
  };
}

/** One GoalOutcome row as a view. Unknown metric ids degrade to unsupported
 *  (a registry rename must never crash a member's goal). */
export function outcomeRowToView(row: GoalOutcome): GoalOutcomeView {
  const metricId =
    row.metricId && isRegisteredMetricId(row.metricId) ? row.metricId : null;
  return {
    id: row.id,
    position: row.position,
    supported: metricId !== null,
    metricId,
    metricRef: row.metricRef,
    label: outcomeLabel(metricId, row.metricRef, row.label, "Tracked manually"),
    startValue: row.startValue,
    targetValue: row.targetValue,
    currentValue: metricId === null ? row.currentValue : null,
    unit: row.unit,
    source: "outcome-row",
  };
}

/**
 * THE resolver every goal surface uses: outcome rows when they exist, else
 * the adapted legacy metric, else no measurable outcomes (a document-only
 * goal; its title/detail still render, nothing is blocked).
 */
export function resolveGoalOutcomes(
  goal: Goal,
  rows: GoalOutcome[]
): GoalOutcomeView[] {
  if (rows.length > 0) {
    return [...rows]
      .sort((a, b) => a.position - b.position)
      .map(outcomeRowToView);
  }
  const legacy = legacyGoalOutcome(goal);
  return legacy ? [legacy] : [];
}
