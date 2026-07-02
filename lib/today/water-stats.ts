import { todayAnchorInTz } from "@/lib/date";

/**
 * Streak + hit-rate stats for the /hydration detail page (VF-6), computed from
 * the tz-anchored daily totals `getWaterDailyTotals` returns. Day keys are the
 * member's local days anchored at 00:00 UTC (FEAT-8), so stepping by whole UTC
 * days is safe.
 */

const DAY_MS = 86_400_000;

export type WaterStats = {
  /** Consecutive goal-hit days ending today (or yesterday, so an unfinished
   *  today never reads as a broken streak). */
  current: number;
  /** Longest goal-hit run in the loaded window. */
  best: number;
  /** Days the goal was hit out of the last 30 (today included). */
  hit30: number;
};

export function computeWaterStats(
  days: { t: number; ml: number }[],
  goalMl: number,
  timezone: string | null
): WaterStats {
  const today = todayAnchorInTz(timezone).getTime();
  const byDay = new Map(days.map((d) => [d.t, d.ml] as const));
  const hit = (t: number) => (byDay.get(t) ?? 0) >= goalMl;

  let current = 0;
  let t = hit(today) ? today : today - DAY_MS;
  while (hit(t)) {
    current++;
    t -= DAY_MS;
  }

  let best = current;
  let run = 0;
  const start = days[0]?.t;
  if (start != null) {
    for (let d = start; d <= today; d += DAY_MS) {
      run = hit(d) ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }

  let hit30 = 0;
  for (let i = 0; i < 30; i++) {
    if (hit(today - i * DAY_MS)) {
      hit30++;
    }
  }

  return { current, best, hit30 };
}
