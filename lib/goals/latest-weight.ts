import type { ProgressEntry } from "@/lib/db/schema";

/**
 * The member's most recent weigh-in, converted into their display unit: the
 * "current" anchor the goal surfaces (/goals, /goals/[id]) feed to the shared
 * goal-progress calc so their bars match /today exactly (DSH-26).
 */

const LB_PER_KG = 2.204_62;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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
