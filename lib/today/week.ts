import {
  calendarDayAnchorInTz,
  formatCalendarDay,
  toCalendarDayISO,
  todayAnchorInTz,
} from "@/lib/date";

/**
 * Shared view-model builders for the tracker cards' 7-day week strips
 * (sleep + hydration) and the sleep "last night" readout. /today, /sleep and
 * /hydration all render the same cards, so the week/readout shapes are built
 * here once instead of being copy-pasted per page. All day math runs on the
 * member's local calendar days (FEAT-8): daily totals are keyed to each local
 * day's 00:00-UTC-anchor ms, the same anchors iterated here.
 *
 * Every strip shows the user's CURRENT Sunday-start calendar week (VF-10),
 * not a rolling window ending today: the leftmost slot is always Sunday, days
 * after today render as quiet "upcoming" slots. The today-cue is structural
 * (a high-contrast ring in the shared WeekStrip), not a text label (VF-11).
 */

const DAY_MS = 86_400_000;

/** Two-letter weekday labels (R2-1): single letters can't disambiguate S/S or
 *  T/T in a 7-day strip. */
export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Strip label for a day slot: always the two-letter weekday. The today-cue
 *  is the shared WeekStrip's ring, not a "Today" word (VF-11). */
export function weekSlotLabel(d: Date): string {
  return WEEKDAY_LABELS[d.getUTCDay()];
}

/**
 * The 7 day-anchors of the user's current Sunday-start calendar week (VF-10),
 * Sunday..Saturday, plus today's anchor ms for the isToday/isFuture tests.
 * Anchors are 00:00-UTC of the user's local days, so `getUTCDay()` on one is
 * the user's local weekday.
 */
export function weekAnchors(timezone: string | null): {
  days: Date[];
  todayMs: number;
} {
  const todayAnchor = todayAnchorInTz(timezone);
  const sunday = new Date(
    todayAnchor.getTime() - todayAnchor.getUTCDay() * DAY_MS
  );
  return {
    days: Array.from(
      { length: 7 },
      (_, i) => new Date(sunday.getTime() + i * DAY_MS)
    ),
    todayMs: todayAnchor.getTime(),
  };
}

/** "Mon, Jun 29" — the real date behind a strip slot, for tooltips (R2-12). */
export function weekSlotDateLabel(d: Date): string {
  return formatCalendarDay(d, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** One night in the sleep card's Sunday-start week strip. */
export type SleepNight = {
  /** Midnight-UTC ms of the day (stable key + chart x). */
  t: number;
  /** Calendar-day ISO (YYYY-MM-DD) — matches the log form's date values. */
  iso: string;
  /** Strip label: the two-letter weekday. */
  label: string;
  /** "Mon, Jun 29" — the real date, for tooltips (R2-12). */
  dateLabel: string;
  /** Minutes slept that night; 0 if not logged. */
  minutes: number;
  quality: number | null;
  logged: boolean;
  isToday: boolean;
  /** Later this week (after today): renders as a quiet upcoming slot. */
  isFuture: boolean;
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

/** One day in the hydration card's Sunday-start week strip. */
export type WaterDay = {
  t: number;
  label: string;
  /** "Mon, Jun 29" — the real date, for tooltips (R2-12). */
  dateLabel: string;
  ml: number;
  logged: boolean;
  isToday: boolean;
  /** Later this week (after today): renders as a quiet upcoming slot. */
  isFuture: boolean;
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
  const { days, todayMs } = weekAnchors(timezone);
  const byDay = new Map(sleepDaily.map((s) => [s.t, s] as const));
  return days.map((d) => {
    const t = d.getTime();
    const entry = byDay.get(t);
    return {
      t,
      iso: toCalendarDayISO(d),
      label: weekSlotLabel(d),
      dateLabel: weekSlotDateLabel(d),
      minutes: entry?.minutes ?? 0,
      quality: entry?.quality ?? null,
      logged: entry != null,
      isToday: t === todayMs,
      isFuture: t > todayMs,
    };
  });
}

/** One day in the workout log card's Sunday-start week strip (R2-14). */
export type WorkoutWeekDay = {
  t: number;
  label: string;
  /** "Mon, Jun 29": the real date, for tooltips (R2-12). */
  dateLabel: string;
  /** Workouts logged that day. */
  count: number;
  logged: boolean;
  isToday: boolean;
  /** Later this week (after today): renders as a quiet upcoming slot. */
  isFuture: boolean;
};

export function buildWorkoutWeek(
  performedAts: Date[],
  timezone: string | null
): WorkoutWeekDay[] {
  const { days, todayMs } = weekAnchors(timezone);
  const counts = new Map<number, number>();
  for (const at of performedAts) {
    const t = calendarDayAnchorInTz(at, timezone).getTime();
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return days.map((d) => {
    const t = d.getTime();
    const count = counts.get(t) ?? 0;
    return {
      t,
      label: weekSlotLabel(d),
      dateLabel: weekSlotDateLabel(d),
      count,
      logged: count > 0,
      isToday: t === todayMs,
      isFuture: t > todayMs,
    };
  });
}

export function buildWaterWeek(
  waterDaily: { t: number; ml: number }[],
  timezone: string | null
): WaterDay[] {
  const { days, todayMs } = weekAnchors(timezone);
  const byDay = new Map(waterDaily.map((w) => [w.t, w.ml] as const));
  return days.map((d) => {
    const t = d.getTime();
    const ml = byDay.get(t);
    return {
      t,
      label: weekSlotLabel(d),
      dateLabel: weekSlotDateLabel(d),
      ml: ml ?? 0,
      logged: ml != null,
      isToday: t === todayMs,
      isFuture: t > todayMs,
    };
  });
}
