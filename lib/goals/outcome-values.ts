import { isGoalReached } from "@/lib/contracts/claims";
import type { PanelState } from "@/lib/contracts/data-state";
import type { Goal, GoalOutcome } from "@/lib/db/schema";
import { resolveGoalOutcomes } from "@/lib/goals/outcomes";
import { computeGoalProgress } from "@/lib/goals/progress";
import {
  convertWeight,
  parseWeightUnit,
  round1,
} from "@/lib/progress/weight";
import { exercise1RMTrend, type WorkoutData } from "@/lib/workouts/stats";

/**
 * THE goal-outcome VALUE resolution (FIX-29 -> FIX-30/FIX-32). One pure
 * module turns a goal + its outcome rows into display-ready outcome values:
 * supported outcomes read their metric's ONE source symbol (trend weight via
 * the EMA, est. 1RM via exercise1RMTrend over CANONICALIZED history, body
 * measurements via the latest logged value); unsupported outcomes show the
 * member-maintained value, labeled. Progress and reached verdicts come from
 * computeGoalProgress + the DSH-62 goalStanding rule, never per-card math.
 *
 * Extracted verbatim from app/progress/page.tsx's private buildGoalVM
 * (P56-E) so /today's primary-goal summary and the /progress overview render
 * a goal through the SAME computation (the DSH-26 two-screens-disagree class
 * is structurally impossible again). Pure: no DB, no React; callers fetch.
 */

export type GoalOutcomeValueVM = {
  label: string;
  supported: boolean;
  /** Formatted current value, from the outcome metric's one source module. */
  currentText: string | null;
  targetText: string | null;
  /** 0..1 progress when start/target/current are all known; else null. */
  fraction: number | null;
  reached: boolean;
};

export type GoalValueVM = {
  id: string;
  title: string;
  /** "48% there" / "Reached" / "2 outcomes tracked". */
  headline: string;
  outcomes: GoalOutcomeValueVM[];
  state: PanelState;
};

/**
 * Latest logged value per measurement kind. Rows arrive OLDEST FIRST
 * (getBodyMeasurementsByUserId's documented order), so the last write wins:
 * the same "latest reading" /progress/body's measurements section headlines.
 * (P56-E fix: the first-wins loop this replaces surfaced the OLDEST reading
 * on goal outcomes while Body showed the latest.)
 */
export function latestMeasurementsByKind(
  rows: ReadonlyArray<{ kind: string; value: number }>
): Map<string, number> {
  const latest = new Map<string, number>();
  for (const m of rows) {
    latest.set(m.kind, m.value);
  }
  return latest;
}

/** The live member data the supported outcome metrics read from. */
export type GoalOutcomeSources = {
  trendWeight: number | null;
  trendUnit: "lb" | "kg";
  canonicalWorkouts: WorkoutData[];
  latestMeasurementByKind: Map<string, number>;
};

export function buildGoalVM(
  goal: Goal,
  outcomeRows: GoalOutcome[],
  sources: GoalOutcomeSources
): GoalValueVM {
  const outcomes = resolveGoalOutcomes(goal, outcomeRows).map((o) => {
    // Supported outcomes read their metric's ONE source module; unsupported
    // outcomes show the member-maintained value, labeled (FIX-29).
    let current: number | null = null;
    if (!o.supported) {
      current = o.currentValue;
    } else if (o.metricId === "body.weight.trend") {
      current =
        sources.trendWeight != null
          ? round1(
              convertWeight(
                sources.trendWeight,
                sources.trendUnit,
                parseWeightUnit(o.unit)
              )
            )
          : null;
    } else if (o.metricId === "training.exercise.e1rm" && o.metricRef) {
      const trend = exercise1RMTrend(sources.canonicalWorkouts, o.metricRef);
      current = trend.length > 0 ? trend[trend.length - 1].value : null;
    } else if (o.metricId === "body.measurement" && o.metricRef) {
      current =
        sources.latestMeasurementByKind.get(o.metricRef.toLowerCase()) ?? null;
    }

    const progress = computeGoalProgress({
      startValue: o.startValue,
      targetValue: o.targetValue,
      current,
    });
    const reached =
      current != null &&
      o.targetValue != null &&
      isGoalReached(o.startValue ?? current, o.targetValue, current);

    const unitSuffix = o.unit ? ` ${o.unit}` : "";
    return {
      label: o.label,
      supported: o.supported,
      currentText: current != null ? `${round1(current)}${unitSuffix}` : null,
      targetText:
        o.targetValue != null ? `${o.targetValue}${unitSuffix}` : null,
      fraction: progress ? Math.min(1, progress.pct / 100) : null,
      reached,
    };
  });

  const primary = outcomes[0];
  const headline = primary?.reached
    ? "Reached"
    : primary?.fraction != null
      ? `${Math.min(99, Math.round(primary.fraction * 100))}% there`
      : `${outcomes.length || "No"} outcome${outcomes.length === 1 ? "" : "s"} tracked`;

  return {
    id: goal.id,
    title: goal.title,
    headline,
    outcomes,
    state: outcomes.length === 0 ? "empty" : "populated",
  };
}
