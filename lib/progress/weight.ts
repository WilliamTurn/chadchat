/**
 * Shared weight display/goal helpers for the Progress surfaces (P56-A).
 * Extracted from the former app/progress/page.tsx so the Body page and the
 * cross-domain overview compute the SAME numbers from the same functions
 * (one-canonical-value law). Conversions ride lib/contracts/units.ts (the
 * one LB_PER_KG).
 */

import { kgToLb, lbToKg } from "@/lib/contracts/units";
import type { Goal } from "@/lib/db/schema";

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function convertWeight(
  weight: number,
  from: "lb" | "kg",
  to: "lb" | "kg"
): number {
  if (from === to) {
    return weight;
  }
  return to === "lb" ? kgToLb(weight) : lbToKg(weight);
}

/** Parse a goal-native unit string ("kg", "kgs", "lb", null) to lb|kg. */
export function parseWeightUnit(unit: string | null): "lb" | "kg" {
  return (unit ?? "").trim().toLowerCase().startsWith("k") ? "kg" : "lb";
}

/** Whether any progress entry carries a weight — i.e. the member has weighed
 * in at least once. Photo- or note-only entries don't count. Guards the
 * first-weigh-in create (onboarding wizard + target editor's missing-data
 * ask) so neither path can ever add a duplicate "first" weigh-in. */
export function hasWeighIn(entries: { weight: number | null }[]): boolean {
  return entries.some((e) => e.weight != null);
}

/** A weigh-in's kilograms — the body weight the energy engine prices
 * exercise estimates against (net METs work in kg). Null when the entry is
 * missing or photo-only. */
export function weighInKg(
  entry: { weight: number | null; unit: "lb" | "kg" } | null
): number | null {
  if (!entry || entry.weight == null) {
    return null;
  }
  return convertWeight(entry.weight, entry.unit, "kg");
}

/** The active weight goal, if any (metric "weight" with a target set). */
export function activeWeightGoal(goals: Goal[]): Goal | null {
  return (
    goals.find((g) => g.metric === "weight" && g.targetValue != null) ?? null
  );
}

/** Convert a goal-native weight value into `displayUnit`. */
export function toDisplayWeight(
  value: number,
  goalUnit: string | null,
  displayUnit: "lb" | "kg"
): number {
  return round1(convertWeight(value, parseWeightUnit(goalUnit), displayUnit));
}

/** The target weight (in `displayUnit`) from the active weight goal, if any. */
export function weightGoalTarget(
  goals: Goal[],
  displayUnit: "lb" | "kg"
): number | null {
  const wg = activeWeightGoal(goals);
  if (!wg || wg.targetValue == null) {
    return null;
  }
  return toDisplayWeight(wg.targetValue, wg.unit, displayUnit);
}

/**
 * The stored start weight (in `displayUnit`) of the active weight goal, if
 * any. This is the shared anchor for goal progress (DSH-26), the same one
 * /today uses, so "Progress to goal" agrees across screens.
 */
export function weightGoalStart(
  goals: Goal[],
  displayUnit: "lb" | "kg"
): number | null {
  const wg = activeWeightGoal(goals);
  if (!wg || wg.startValue == null) {
    return null;
  }
  return toDisplayWeight(wg.startValue, wg.unit, displayUnit);
}
