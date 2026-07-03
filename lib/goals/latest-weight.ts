import { ema } from "@/lib/chart/trend";
import type { ProgressEntry } from "@/lib/db/schema";

/**
 * Weigh-in → display-unit helpers for the goal surfaces (/goals, /goals/[id]).
 * The "current" anchor they feed to the shared goal-progress calc is the
 * smoothed **trend weight** (`trendWeightInUnit`) — the app's one canonical
 * current weight (LC-4) — so their bars match /today and /progress exactly
 * (DSH-26). The raw latest weigh-in stays available for labeled display.
 */

const LB_PER_KG = 2.204_62;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function convertWeight(
  value: number,
  from: "lb" | "kg",
  to: "lb" | "kg"
): number {
  if (from === to) {
    return value;
  }
  return to === "lb" ? value * LB_PER_KG : value / LB_PER_KG;
}

/** Convert a goal-native weight (free-text unit: "lbs", "kg", null) into the
 *  display unit, with the same parse + round /progress applies to goal lines. */
export function toDisplayWeight(
  value: number,
  goalUnit: string | null,
  displayUnit: "lb" | "kg"
): number {
  const from: "lb" | "kg" = (goalUnit ?? "")
    .trim()
    .toLowerCase()
    .startsWith("k")
    ? "kg"
    : "lb";
  return round1(convertWeight(value, from, displayUnit));
}

/** Every weigh-in as a chart point in `unit`, oldest → newest: the same
 *  series /progress plots, for re-plotting against a goal line (VF-6). */
export function weightPointsInUnit(
  entries: ProgressEntry[],
  unit: "lb" | "kg"
): { t: number; weight: number }[] {
  return entries
    .filter((e): e is ProgressEntry & { weight: number } => e.weight != null)
    .map((e) => ({
      t: e.recordedAt.getTime(),
      weight: round1(convertWeight(e.weight, e.unit, unit)),
    }));
}

export function latestWeightInUnit(
  entries: ProgressEntry[],
  preferredUnit: "lb" | "kg" | null
): { value: number; unit: "lb" | "kg" } | null {
  const weighed = entries.filter(
    (e): e is ProgressEntry & { weight: number } => e.weight != null
  );
  const last = weighed.at(-1);
  if (!last) {
    return null;
  }
  // Account-level unit preference wins, else the latest weigh-in's own unit.
  const unit: "lb" | "kg" = preferredUnit ?? last.unit;
  const value = round1(
    last.unit === unit
      ? last.weight
      : unit === "lb"
        ? last.weight * LB_PER_KG
        : last.weight / LB_PER_KG
  );
  return { value, unit };
}

/**
 * The member's smoothed trend weight in their display unit — the same gap-aware
 * EMA every weight chart draws, evaluated at the latest weigh-in. This is the
 * canonical "current weight" (LC-4); feed it to `computeGoalProgress`.
 */
export function trendWeightInUnit(
  entries: ProgressEntry[],
  preferredUnit: "lb" | "kg" | null
): { value: number; unit: "lb" | "kg" } | null {
  const latest = latestWeightInUnit(entries, preferredUnit);
  if (!latest) {
    return null;
  }
  const rows = ema(weightPointsInUnit(entries, latest.unit));
  const trend = rows.at(-1)?.trend;
  return trend == null ? latest : { value: trend, unit: latest.unit };
}
