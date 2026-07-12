/**
 * WINDOW-AXIS MATH (FIX-18 / DSH-60). Pure, React-free.
 *
 * The rule this module enforces, stated once so no chart re-decides it:
 *
 *   A TIME AXIS SPANS THE SELECTED WINDOW, NEVER THE DATA EXTENT.
 *
 * Two logged days inside a 30-day window sit at their true dates on a full
 * 30-day axis; sparse data READS sparse instead of stretching to the frame
 * edges. Every shared chart derives its x-domain, its ticks, and its day/week
 * slots from a ChartWindow built here, so the axis cannot silently follow
 * `dataMin`/`dataMax`.
 *
 * All timestamps are 00:00-UTC day anchors (the app's calendar-day convention,
 * see lib/date.ts and tests/fixtures/dashboard-states.ts). "Today" is always
 * passed in by the caller (member-local day anchor, or the fixture anchor) so
 * this module stays deterministic.
 */

import { MS_PER_DAY } from "@/lib/chart/trend";

/** An inclusive calendar window of whole days, in day-anchor ms. */
export type ChartWindow = {
  /** 00:00-UTC anchor of the first day in the window. */
  startMs: number;
  /** 00:00-UTC anchor of the last day in the window (usually "today"). */
  endMs: number;
  /** Day count, inclusive: endMs is day `days - 1` after startMs. */
  days: number;
};

/** The `days`-day window ending at (and including) the day of `endDayMs`. */
export function windowEndingAt(endDayMs: number, days: number): ChartWindow {
  const n = Math.max(1, Math.round(days));
  return {
    startMs: endDayMs - (n - 1) * MS_PER_DAY,
    endMs: endDayMs,
    days: n,
  };
}

/**
 * The "All" window: first logged day through today. Falls back to a minimum
 * span so a member with one logged day still gets a real axis, not a point.
 */
export function windowFromExtent(
  rows: readonly { t: number }[],
  endDayMs: number,
  minDays = 7
): ChartWindow {
  if (rows.length === 0) {
    return windowEndingAt(endDayMs, minDays);
  }
  const first = Math.min(...rows.map((r) => r.t));
  const days = Math.round((endDayMs - first) / MS_PER_DAY) + 1;
  return windowEndingAt(endDayMs, Math.max(days, minDays));
}

/** Rows inside the window, inclusive. */
export function clampToWindow<T extends { t: number }>(
  rows: readonly T[],
  w: ChartWindow
): T[] {
  return rows.filter((r) => r.t >= w.startMs && r.t <= w.endMs + MS_PER_DAY - 1);
}

/**
 * Explicit x-axis tick values spanning the window: first day, last day, and
 * evenly stepped whole-day ticks between them. Charts pass these to the axis
 * verbatim so the frame edges always carry a date (the Stripe/Whoop pattern)
 * and the tick count stays readable at every width.
 */
export function windowTicks(w: ChartWindow, maxTicks = 6): number[] {
  const n = Math.max(2, maxTicks);
  if (w.days <= 1) {
    return [w.startMs];
  }
  const stepDays = Math.max(1, Math.ceil((w.days - 1) / (n - 1)));
  const ticks: number[] = [];
  for (let t = w.startMs; t < w.endMs; t += stepDays * MS_PER_DAY) {
    ticks.push(t);
  }
  // The last day is always a tick; drop a crowding neighbor if needed.
  const last = ticks[ticks.length - 1];
  if (w.endMs - last < stepDays * MS_PER_DAY * 0.5) {
    ticks.pop();
  }
  ticks.push(w.endMs);
  return ticks;
}

/** Every 00:00-UTC day anchor in the window, oldest first. */
export function windowDayAnchors(w: ChartWindow): number[] {
  const out: number[] = [];
  for (let t = w.startMs; t <= w.endMs; t += MS_PER_DAY) {
    out.push(t);
  }
  return out;
}

/**
 * One slot per window day. `value: null` = unlogged, and stays null: the
 * missing-is-never-zero law (lib/contracts/data-state.ts) at the chart layer.
 * Bar charts render null as a gap/hollow slot, never a zero-height bar.
 */
export type DaySlot = { t: number; value: number | null };

export function toDaySlots(
  w: ChartWindow,
  logged: readonly { t: number; value: number }[]
): DaySlot[] {
  const byDay = new Map<number, number>();
  for (const row of logged) {
    // Snap to the containing day anchor so instants land in their day.
    const day = w.startMs + Math.floor((row.t - w.startMs) / MS_PER_DAY) * MS_PER_DAY;
    if (row.t >= w.startMs && row.t <= w.endMs + MS_PER_DAY - 1) {
      byDay.set(day, (byDay.get(day) ?? 0) + row.value);
    }
  }
  return windowDayAnchors(w).map((t) => ({ t, value: byDay.get(t) ?? null }));
}

/**
 * One slot per trailing 7-day bin, oldest first, for frequency charts.
 * `value` is a COUNT OF LOGGED EVENTS, so 0 is a truthful observed value
 * (the owner-approved carve-out in lib/contracts/data-state.ts): a week with
 * no sessions renders a zero bar, never "Not logged".
 */
export type WeekSlot = { t: number; value: number };

export function toWeekSlots(
  w: ChartWindow,
  events: readonly { t: number }[]
): WeekSlot[] {
  const weeks = Math.max(1, Math.ceil(w.days / 7));
  // Bins are anchored to the window END so "this week" is always a full bin.
  const slots: WeekSlot[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const binEnd = w.endMs - i * 7 * MS_PER_DAY;
    const binStart = binEnd - 6 * MS_PER_DAY;
    const value = events.filter(
      (e) => e.t >= binStart && e.t <= binEnd + MS_PER_DAY - 1
    ).length;
    slots.push({ t: binStart, value });
  }
  return slots;
}
