/**
 * The single definition of weight-goal progress, shared by `/today` (the goal
 * card) and `/progress` (the "Progress to goal" bar) so the two screens never
 * disagree (DSH-26).
 *
 * Pure and React-free — every result derives from the passed numbers, so this is
 * deterministic and unit-testable.
 *
 * Anchored on the goal's **stored start weight** (`goal.startValue`) — the weight
 * captured when the goal was created — so the percentage reflects progress on
 * THIS goal, not lifetime weight history. Before this existed, the two screens
 * disagreed badly: the dashboard anchored on `goal.startValue` while Progress
 * anchored on the first-ever weigh-in, so the same goal read 26% on `/today` and
 * 38% on `/progress`. Falls back to the earliest weigh-in only when a goal has no
 * stored start (older goals created before the field existed).
 *
 * `current` and `firstWeight` are supplied by the caller so each screen can pass
 * whatever value it already treats as "now" (raw weigh-in or smoothed trend) —
 * the START anchor is what has to agree, and that's `startValue`.
 */

/** Round to one decimal place (matches `lib/chart/trend`). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type GoalProgress = {
  /** The start weight the calc is anchored on (goal.startValue, or a fallback). */
  start: number;
  /** The current weight used (whatever the caller passed). */
  current: number;
  /** The target weight. */
  target: number;
  /** Signed change from start (`current - start`); negative for weight lost. */
  sinceStart: number;
  /** Absolute weight still to cover to reach the target. */
  toGo: number;
  /** Progress toward the goal, 0–100 (integer), clamped. */
  pct: number;
  /** True once the target has been reached. */
  reached: boolean;
};

export function computeGoalProgress({
  startValue,
  targetValue,
  current,
  firstWeight,
}: {
  startValue: number | null | undefined;
  targetValue: number | null | undefined;
  current: number | null | undefined;
  firstWeight?: number | null | undefined;
}): GoalProgress | null {
  if (targetValue == null || current == null) {
    return null;
  }
  // Anchor: the goal's stored start → else the first weigh-in → else "now"
  // (a brand-new goal logged the same day as the only weigh-in reads 0%).
  const start = startValue ?? firstWeight ?? current;
  const span = targetValue - start;
  const done = current - start;
  // Works whether the target is above or below the start (gain or loss).
  const pct =
    span === 0 ? 100 : Math.max(0, Math.min(100, Math.round((done / span) * 100)));
  return {
    start,
    current,
    target: targetValue,
    sinceStart: round1(current - start),
    toGo: round1(Math.abs(targetValue - current)),
    pct,
    reached: pct >= 100,
  };
}
