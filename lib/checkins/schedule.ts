// Pure slot math for the proactive check-ins (FEAT-11 → FEAT-8). The cron runs
// HOURLY; each pass asks, per member: "on YOUR wall clock, is it morning-brief
// time or evening-callout time?" — so the brief lands around everyone's own
// ~7am and the callout around their own ~8pm, instead of one fixed UTC instant
// (which meant ~9am/9pm for the East Coast and the wrong hours everywhere
// else). No "server-only": pure functions, unit-tested in tests/unit.

import { localDayHour } from "@/lib/reports/schedule";

export type CheckInSlot = "morning" | "evening";

// Local-hour windows, [start, end). A few hours wide so a skipped or delayed
// cron run still delivers a little later the same morning/evening (the
// per-slot ledger dedup stops repeats), but bounded so a "nothing to say"
// member isn't re-evaluated by the model all day long.
export const MORNING_WINDOW = { start: 7, end: 10 };
export const EVENING_WINDOW = { start: 20, end: 23 };

/**
 * Which check-in slot (if any) is live for this member right now, on their own
 * wall clock. Null outside both windows — the hourly pass just skips them.
 */
export function dueCheckInSlot(
  now: Date,
  timezone: string | null | undefined
): CheckInSlot | null {
  const { hour } = localDayHour(now, timezone);
  if (hour >= MORNING_WINDOW.start && hour < MORNING_WINDOW.end) {
    return "morning";
  }
  if (hour >= EVENING_WINDOW.start && hour < EVENING_WINDOW.end) {
    return "evening";
  }
  return null;
}
