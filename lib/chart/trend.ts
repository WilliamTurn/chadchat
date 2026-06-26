/**
 * Pure, React-free chart math shared across the dashboard charts (weight, 1RM,
 * nutrition, water). No DOM, no `Date.now()` — every result derives from the
 * passed series, so this is deterministic and unit-testable.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TimePoint = { t: number; weight: number };
export type TrendRow = { t: number; weight: number; trend: number };

/** Round to one decimal place. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Gap-aware **exponential moving average** — the trend line serious
 * scale-tracking apps (TrendWeight, MacroFactor) show. Unlike a centered SMA it
 * is defined right up to the latest weigh-in (no right-edge degradation, which
 * is exactly the part users care about most) and it handles irregular spacing:
 * the smoothing factor `alpha` scales with the real time gap between points, so
 * a weigh-in after a two-week break is weighted differently than a daily one.
 *
 *   trend[0] = weight[0]
 *   alpha    = 1 - exp(-dtDays / tau)
 *   trend[i] = trend[i-1] + alpha * (weight[i] - trend[i-1])
 *
 * @param points oldest-first series
 * @param tau    smoothing time-constant in days (sane range 7–14; 10 default)
 */
export function ema(points: TimePoint[], tau = 10): TrendRow[] {
  if (points.length === 0) {
    return [];
  }
  const out: TrendRow[] = [];
  let trend = points[0].weight;
  out.push({ t: points[0].t, weight: points[0].weight, trend });
  for (let i = 1; i < points.length; i++) {
    const dtDays = Math.max(0, (points[i].t - points[i - 1].t) / MS_PER_DAY);
    const alpha = 1 - Math.exp(-dtDays / tau);
    trend += alpha * (points[i].weight - trend);
    out.push({ t: points[i].t, weight: points[i].weight, trend });
  }
  // Round only on the way out so intermediate smoothing keeps full precision.
  return out.map((r) => ({
    t: r.t,
    weight: round1(r.weight),
    trend: round1(r.trend),
  }));
}

/** Total span of a series in days (0 for fewer than two points). */
export function spanDays(rows: { t: number }[]): number {
  if (rows.length < 2) {
    return 0;
  }
  return (rows[rows.length - 1].t - rows[0].t) / MS_PER_DAY;
}

/** Mean rate of trend change per week over the row span. 0 if span is 0. */
export function ratePerWeek(rows: TrendRow[]): number {
  if (rows.length < 2) {
    return 0;
  }
  const days = spanDays(rows);
  if (days <= 0) {
    return 0;
  }
  const delta = rows[rows.length - 1].trend - rows[0].trend;
  return (delta / days) * 7;
}

/**
 * Linear projection of when the trend reaches `goal`, extrapolating the current
 * per-day rate forward from `fromMs`. Returns null when there is no honest ETA:
 * the goal is already met, the rate is negligible, or the trend is moving *away*
 * from the goal.
 */
export function projectToGoal(
  currentTrend: number,
  ratePerDay: number,
  goal: number,
  fromMs: number
): { days: number; dateMs: number } | null {
  const remaining = goal - currentTrend;
  if (Math.abs(remaining) < 0.05) {
    return null; // already there
  }
  if (Math.abs(ratePerDay) < 0.002) {
    return null; // essentially flat — no trustworthy ETA
  }
  if (Math.sign(ratePerDay) !== Math.sign(remaining)) {
    return null; // moving away from the goal
  }
  const days = remaining / ratePerDay;
  if (!Number.isFinite(days) || days <= 0) {
    return null;
  }
  return { days, dateMs: fromMs + days * MS_PER_DAY };
}

/** Filter rows to the last `days` window, relative to the latest row. */
export function withinDays<T extends { t: number }>(rows: T[], days: number): T[] {
  if (rows.length === 0) {
    return rows;
  }
  const cutoff = rows[rows.length - 1].t - days * MS_PER_DAY;
  return rows.filter((r) => r.t >= cutoff);
}
