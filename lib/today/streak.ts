/**
 * Pure streak math, extracted from app/home/page.tsx (P2-A quick win pinned
 * by Phase 1). This is the registered source of `engagement.streak.days`
 * (lib/contracts/metrics.ts); the definition there is owner-approved, so the
 * semantics here must not drift without a tracker decision-log entry.
 *
 * No DB / React imports: usable in server components, tests, and fixtures.
 */

import { calendarDayAnchorInTz, toCalendarDayISO, todayAnchorInTz } from "@/lib/date";

const DAY_MS = 86_400_000;

/** Consecutive days (ending today or yesterday) with at least one logged action.
 *  Days are the user's local calendar days (FEAT-8): a late-night log counts
 *  toward THEIR today, not the next UTC day. */
export function computeStreak(dates: Date[], timezone: string | null): number {
  if (dates.length === 0) {
    return 0;
  }
  const days = new Set(
    dates.map((d) => toCalendarDayISO(calendarDayAnchorInTz(d, timezone)))
  );
  let cursor = todayAnchorInTz(timezone);
  if (!days.has(toCalendarDayISO(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!days.has(toCalendarDayISO(cursor))) {
      return 0;
    }
  }
  let streak = 0;
  while (days.has(toCalendarDayISO(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}
