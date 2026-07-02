import {
  calendarDayAnchorInTz,
  formatCalendarDay,
  toCalendarDayISO,
  todayAnchorInTz,
} from "@/lib/date";

/**
 * Shared view-model builders for the tracker cards' rolling 7-day strips
 * (sleep + hydration) and the sleep "last night" readout. /today, /sleep and
 * /hydration all render the same cards, so the week/readout shapes are built
 * here once instead of being copy-pasted per page. All day math runs on the
 * member's local calendar days (FEAT-8): daily totals are keyed to each local
 * day's 00:00-UTC-anchor ms, the same anchors iterated here.
 */

const DAY_MS = 86_400_000;

/** Two-letter weekday labels (R2-1): single letters can't disambiguate S/S or
 *  T/T in a rolling 7-day strip. */
export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Strip label for a day slot: the last slot says "Today" outright (R2-1's
 *  explicit Today marker), the rest get two-letter weekdays. */
export function weekSlotLabel(d: Date, isToday: boolean): string {
  return isToday ? "Today" : WEEKDAY_LABELS[d.getUTCDay()];
}

/** "Mon, Jun 29" — the real date behind a strip slot, for tooltips (R2-12). */
export function weekSlotDateLabel(d: Date): string {
  return formatCalendarDay(d, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** One night in the sleep card's rolling 7-day strip. */
export type SleepNight = {
  /** Midnight-UTC ms of the day (stable key + chart x). */
  t: number;
  /** Calendar-day ISO (YYYY-MM-DD) — matches the log form's date values. */
  iso: string;
  /** Strip label: two-letter weekday, or "Today" for the last slot. */
  label: string;
  /** "Mon, Jun 29" — the real date, for tooltips (R2-12). */
  dateLabel: string;
  /** Minutes slept that night; 0 if not logged. */
  minutes: number;
  quality: number | null;
  logged: boolean;
  isToday: boolean;
};

export type LastNight = {
  minutes: number;
  quality: number | null;
  /**
   * True when the entry is for today or yesterday — i.e. it genuinely
   * describes last night. A stale entry must not be framed as "Last night"
   * with a fresh verdict (audit P1-2).
   */
  isCurrent: boolean;
  /** "Sun, Jun 29" — when the entry is for, shown for stale entries. */
  dateLabel: string;
} | null;

/** One day in the hydration card's rolling 7-day strip. */
export type WaterDay = {
  t: number;
  label: string;
  /** "Mon, Jun 29" — the real date, for tooltips (R2-12). */
  dateLabel: string;
  ml: number;
  logged: boolean;
  isToday: boolean;
};

export function buildLastNight(
  latest: { recordedAt: Date; minutes: number; quality: number | null } | null,
  timezone: string | null
): LastNight {
  if (!latest) {
    return null;
  }
  const today = todayAnchorInTz(timezone);
  const that = calendarDayAnchorInTz(latest.recordedAt, timezone);
  const diffDays = Math.round((today.getTime() - that.getTime()) / DAY_MS);
  return {
    minutes: latest.minutes,
    quality: latest.quality,
    isCurrent: diffDays <= 1,
    dateLabel: formatCalendarDay(latest.recordedAt, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  };
}

export function buildSleepWeek(
  sleepDaily: { t: number; minutes: number; quality: number | null }[],
  timezone: string | null
): SleepNight[] {
  const todayAnchor = todayAnchorInTz(timezone);
  const byDay = new Map(sleepDaily.map((s) => [s.t, s] as const));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayAnchor.getTime() - (6 - i) * DAY_MS);
    const entry = byDay.get(d.getTime());
    return {
      t: d.getTime(),
      iso: toCalendarDayISO(d),
      label: weekSlotLabel(d, i === 6),
      dateLabel: weekSlotDateLabel(d),
      minutes: entry?.minutes ?? 0,
      quality: entry?.quality ?? null,
      logged: entry != null,
      isToday: i === 6,
    };
  });
}

export function buildWaterWeek(
  waterDaily: { t: number; ml: number }[],
  timezone: string | null
): WaterDay[] {
  const todayAnchor = todayAnchorInTz(timezone);
  const byDay = new Map(waterDaily.map((w) => [w.t, w.ml] as const));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayAnchor.getTime() - (6 - i) * DAY_MS);
    const ml = byDay.get(d.getTime());
    return {
      t: d.getTime(),
      label: weekSlotLabel(d, i === 6),
      dateLabel: weekSlotDateLabel(d),
      ml: ml ?? 0,
      logged: ml != null,
      isToday: i === 6,
    };
  });
}
