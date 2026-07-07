// Pure slot math for the proactive check-ins (FEAT-11 → FEAT-8 → FEAT-15).
// The cron runs HOURLY; each pass asks, per member: "on YOUR wall clock, is it
// YOUR morning-brief time or YOUR evening-callout time, on a day you allow
// Chad to email?" The member picks the days + hours on /account, instead of
// the old hardcoded 7-10am / 8-11pm windows. No "server-only": pure functions,
// unit-tested in tests/unit.

import { localDayHour } from "@/lib/reports/schedule";

export type CheckInSlot = "morning" | "evening";

/** What dueCheckInSlot needs to know about a member (a subset of User). */
export type CheckInSchedulePrefs = {
  checkInFrequency: "daily" | "three_per_week" | "weekly";
  checkInDays: number[];
  checkInMorningHour: number;
  checkInEveningHour: number;
  timezone: string | null;
};

// Each slot's delivery window is [chosenHour, chosenHour + WINDOW_HOURS). A
// few hours wide so a skipped or delayed cron run still delivers a little
// later the same morning/evening (the per-slot ledger dedup stops repeats),
// but bounded so a "nothing to say" member isn't re-evaluated by the model
// all day long.
export const WINDOW_HOURS = 3;

// Defaults mirror the schema (schema.ts User.checkIn*): brief from 7am,
// callout from 8pm, Mon/Wed/Fri for the non-daily frequencies.
export const DEFAULT_MORNING_HOUR = 7;
export const DEFAULT_EVENING_HOUR = 20;
export const DEFAULT_CHECK_IN_DAYS = [1, 3, 5];

// What the /account pickers offer. Morning stays morning-shaped and evening
// evening-shaped so the two windows can never collide or wrap past midnight.
export const MORNING_HOUR_CHOICES = [5, 6, 7, 8, 9, 10, 11];
export const EVENING_HOUR_CHOICES = [17, 18, 19, 20, 21];

/** How many days the member may pick for each frequency. */
export function maxDaysForFrequency(
  frequency: CheckInSchedulePrefs["checkInFrequency"]
): number {
  return frequency === "weekly" ? 1 : 3;
}

function sanitizeHour(hour: unknown, fallback: number, choices: number[]) {
  return typeof hour === "number" && choices.includes(hour) ? hour : fallback;
}

/** A bad stored value must never crash the cron pass, so clean everything. */
export function sanitizeCheckInDays(days: unknown): number[] {
  if (!Array.isArray(days)) {
    return DEFAULT_CHECK_IN_DAYS;
  }
  const clean = [
    ...new Set(
      days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) as number[]
    ),
  ].sort((a, b) => a - b);
  return clean.length > 0 ? clean : DEFAULT_CHECK_IN_DAYS;
}

/**
 * Which check-in slot (if any) is live for this member right now, on their own
 * wall clock and their own /account schedule. Null outside their windows (or
 * on a day they didn't pick), and the hourly pass just skips them.
 *
 * `dangerWindow` (FEAT-22, capped by FEAT-25): while the member's quit-date
 * prediction says they are inside the fold window, cadence escalates — but
 * ONLY the morning brief. The chosen-days gate is ignored for the morning
 * slot (every frequency gets a daily brief), because the prediction is
 * precisely WHEN they are weakest and Chad shows up exactly then; the evening
 * callout fires only when the member's normal chosen schedule would have sent
 * it anyway. That caps escalation at one extra email a day (≤8 across the
 * 8-day window) instead of two. The hour windows still apply: escalation
 * never emails anyone at 3am.
 */
export function dueCheckInSlot(
  now: Date,
  prefs: CheckInSchedulePrefs,
  opts: { dangerWindow?: boolean } = {}
): CheckInSlot | null {
  const { day, hour } = localDayHour(now, prefs.timezone);

  const onChosenDay =
    prefs.checkInFrequency === "daily" ||
    sanitizeCheckInDays(prefs.checkInDays).includes(day);

  const morning = sanitizeHour(
    prefs.checkInMorningHour,
    DEFAULT_MORNING_HOUR,
    MORNING_HOUR_CHOICES
  );
  const evening = sanitizeHour(
    prefs.checkInEveningHour,
    DEFAULT_EVENING_HOUR,
    EVENING_HOUR_CHOICES
  );

  if (hour >= morning && hour < morning + WINDOW_HOURS) {
    return onChosenDay || opts.dangerWindow ? "morning" : null;
  }
  if (hour >= evening && hour < evening + WINDOW_HOURS) {
    return onChosenDay ? "evening" : null;
  }
  return null;
}
