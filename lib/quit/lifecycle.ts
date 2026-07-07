/**
 * The Quit Date lifecycle math (FEAT-22): day-of-membership counting, the
 * danger window, and the beaten/hit outcome rules. Pure by design (like
 * lib/quit/heuristics.ts) so the unit tests run it directly under node --test.
 *
 * Anchor convention: every Date here is a 00:00-UTC calendar-day anchor — the
 * shape todayAnchorInTz / calendarDayAnchorInTz return and the shape
 * QuitPrediction.quitDate is stored in (runAutopsy builds it from
 * todayAnchorInTz + whole days). Day arithmetic is plain ± DAY_MS.
 */

export const DAY_MS = 86_400_000;

// The ambush window around the predicted date: the prediction says THIS is
// when the member is weakest, so Chad escalates from quitDate - 5 days
// through quitDate + 2 days (the spec's "roughly minus 5 through a few
// days after").
export const DANGER_WINDOW_BEFORE_DAYS = 5;
export const DANGER_WINDOW_AFTER_DAYS = 2;

// How many full days past the predicted date with zero logged activity count
// as "went silent" — the prediction HIT. Until then a quiet member is still
// pending (they get the grace to come back and beat it).
export const HIT_SILENCE_DAYS = 3;

/** Day 1 of the prediction (the day the autopsy ran), derived from the stored
 * quit date and its day count so no extra column is needed. */
export function dayOneAnchor(quitDateAnchor: Date, dayCount: number): Date {
  return new Date(quitDateAnchor.getTime() - (dayCount - 1) * DAY_MS);
}

/** Which day-of-membership `anchor` is (day 1 = the autopsy day). */
export function dayNumberOn(
  anchor: Date,
  quitDateAnchor: Date,
  dayCount: number
): number {
  const dayOne = dayOneAnchor(quitDateAnchor, dayCount);
  return Math.floor((anchor.getTime() - dayOne.getTime()) / DAY_MS) + 1;
}

/** Whole days from `todayAnchor` to the predicted date (negative = past it). */
export function daysUntilQuit(todayAnchor: Date, quitDateAnchor: Date): number {
  return Math.round((quitDateAnchor.getTime() - todayAnchor.getTime()) / DAY_MS);
}

/** True inside [quitDate - 5d, quitDate + 2d] — the escalation window. */
export function isInDangerWindow(
  todayAnchor: Date,
  quitDateAnchor: Date
): boolean {
  const until = daysUntilQuit(todayAnchor, quitDateAnchor);
  return (
    until <= DANGER_WINDOW_BEFORE_DAYS && until >= -DANGER_WINDOW_AFTER_DAYS
  );
}

export type QuitOutcome = "pending" | "beaten" | "hit";

/**
 * Resolve an active prediction against reality:
 * - Any logged activity on a day STRICTLY AFTER the predicted date = the
 *   member outlived the prediction → "beaten".
 * - No such activity and HIT_SILENCE_DAYS full days have passed since the
 *   date → they went silent, Chad called it → "hit".
 * - Otherwise → "pending" (the date hasn't arrived, or the grace window is
 *   still open).
 * `lastActivityAnchor` is the member's most recent activity day (null when
 * they never logged anything).
 */
export function quitOutcome({
  todayAnchor,
  quitDateAnchor,
  lastActivityAnchor,
}: {
  todayAnchor: Date;
  quitDateAnchor: Date;
  lastActivityAnchor: Date | null;
}): QuitOutcome {
  if (todayAnchor.getTime() <= quitDateAnchor.getTime()) {
    return "pending";
  }
  if (
    lastActivityAnchor &&
    lastActivityAnchor.getTime() > quitDateAnchor.getTime()
  ) {
    return "beaten";
  }
  if (daysUntilQuit(todayAnchor, quitDateAnchor) <= -HIT_SILENCE_DAYS) {
    return "hit";
  }
  return "pending";
}
