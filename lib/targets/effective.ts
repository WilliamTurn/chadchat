/**
 * Effective-dated target resolution (FIX-07, P4 / DSH-66). Pure functions;
 * lib/db/queries.ts fetches version rows and executes write plans, this
 * module decides which version governs which member-local day.
 *
 * The contract (metrics.ts target definitions + the tracker FIX-07 row):
 * historical adherence uses the target that was ACTIVE ON THAT DAY; changing
 * a target is forward-only and never rewrites how a past day is interpreted
 * (the MacroFactor / MyFitnessPal model, evidence-p34c/benchmark-teardown.md).
 *
 * Day identity is the member-local calendar day as a 00:00-UTC anchor
 * (lib/date.ts calendarDayAnchorInTz / todayAnchorInTz with user.timezone),
 * the same day-key shape every chart and bucketing helper uses.
 *
 * Resolution rule: the version governing day D is the one with the greatest
 * effectiveDay <= D; ties (same-day re-edits) break by createdAt, latest
 * wins. Days before a member's first-ever version have no target (null);
 * adherence against a target that did not exist is not computable.
 *
 * Legacy fallback rule: a member with ZERO version rows keeps resolving every
 * day to their live current-pointer target (NutritionTarget row / User goal
 * columns), which is exactly the pre-FIX-07 behavior. The moment they have
 * any version row, versions are the only truth (the first write epoch-seeds
 * the old value, so coverage is continuous; see planTargetWrite).
 */

export type EffectiveVersion<T> = {
  /** 00:00-UTC anchor of the first member-local day this version governs. */
  effectiveDayMs: number;
  createdAtMs: number;
  values: T;
};

/** The epoch day-anchor used to seed a member's pre-history target. */
export const EPOCH_DAY_MS = 0;

/**
 * The values governing `dayAnchorMs`, or null when no version covers it.
 * `versions` need not be sorted.
 */
export function activeVersionValues<T>(
  versions: readonly EffectiveVersion<T>[],
  dayAnchorMs: number
): T | null {
  let best: EffectiveVersion<T> | null = null;
  for (const v of versions) {
    if (v.effectiveDayMs > dayAnchorMs) {
      continue;
    }
    if (
      !best ||
      v.effectiveDayMs > best.effectiveDayMs ||
      (v.effectiveDayMs === best.effectiveDayMs &&
        v.createdAtMs > best.createdAtMs)
    ) {
      best = v;
    }
  }
  return best ? best.values : null;
}

/**
 * Resolve one value per requested day anchor, applying the legacy fallback
 * rule: with zero versions every day resolves to `noVersionsFallback` (the
 * live current-pointer target, preserving pre-FIX-07 behavior); with any
 * versions, versions are the only truth.
 */
export function resolveTargetByDay<T>(
  versions: readonly EffectiveVersion<T>[],
  dayAnchorsMs: readonly number[],
  noVersionsFallback: T | null
): (T | null)[] {
  if (versions.length === 0) {
    return dayAnchorsMs.map(() => noVersionsFallback);
  }
  return dayAnchorsMs.map((day) => activeVersionValues(versions, day));
}

/**
 * Plan the version-row inserts for one target write. Pure so the FIX-07
 * invariant is unit-testable without a database; the queries.ts funnels
 * execute the returned inserts (in order) inside the same transaction that
 * updates the live current-pointer row.
 *
 * - First-ever version write for a member who already HAD a target: the old
 *   value is epoch-seeded first, so past days keep resolving to it.
 * - First-ever write with no prior target: no seed; days before this write
 *   genuinely had no target.
 * - Later writes: just the new version, effective from the member's today.
 */
export function planTargetWrite<T>(args: {
  hasVersions: boolean;
  /** The live current-pointer value BEFORE this write; null = none existed. */
  previous: T | null;
  next: T;
  /** todayAnchorInTz(user.timezone).getTime() */
  todayAnchorMs: number;
}): { effectiveDayMs: number; values: T }[] {
  const inserts: { effectiveDayMs: number; values: T }[] = [];
  if (!args.hasVersions && args.previous !== null) {
    inserts.push({ effectiveDayMs: EPOCH_DAY_MS, values: args.previous });
  }
  inserts.push({ effectiveDayMs: args.todayAnchorMs, values: args.next });
  return inserts;
}
