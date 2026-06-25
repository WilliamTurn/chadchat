/**
 * Calendar-day helpers — the single source of truth for "a day the user picked"
 * (a weigh-in date, a workout date, the day a meal was eaten).
 *
 * The bug these fix: a bare "YYYY-MM-DD" parsed with `new Date(s)` lands on
 * UTC midnight, and `toLocaleDateString()` then renders it in the *viewer's*
 * timezone — so a weigh-in/meal/workout shows up a day early for anyone west of
 * UTC. The fix is one convention applied everywhere:
 *
 *   - STORE the picked day anchored at **noon UTC** (`parseCalendarDay`). Noon
 *     (not midnight) gives a ±12h buffer so a non-UTC server reading the value
 *     back never slips to the adjacent day.
 *   - DISPLAY it formatted **in UTC** (`formatCalendarDay`) so the rendered day
 *     always equals the day the user picked, regardless of where it renders.
 *   - DEFAULT date inputs to the user's **local** today (`todayLocalISO`), which
 *     on the client is their real calendar day — not the UTC day, which can
 *     already be "tomorrow" late at night in the Americas.
 *
 * No deps; safe in server components, server actions, and client components.
 */

const CALENDAR_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a "YYYY-MM-DD" calendar day into a Date anchored at 12:00 UTC of that
 * day. Returns null for empty/malformed input so callers can fall back to now.
 */
export function parseCalendarDay(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const match = CALENDAR_DAY_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parse a date input that may be either a bare calendar day ("YYYY-MM-DD") or a
 * full ISO timestamp. Calendar days are anchored at noon UTC; full timestamps
 * are kept as-is. Falls back to `new Date()` when missing/unparseable. Used
 * where the input source is loose (e.g. a date Chad passes to a tool).
 */
export function parseDateInput(value: string | null | undefined): Date {
  const day = parseCalendarDay(value);
  if (day) {
    return day;
  }
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

/** The calendar day a stored Date falls on, as "YYYY-MM-DD" in UTC. */
export function toCalendarDayISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Today's calendar day as "YYYY-MM-DD" in the runtime's LOCAL timezone. On the
 * client this is the user's real local day — the correct default for a date
 * picker. (`new Date().toISOString()` would give the UTC day, which is wrong
 * for the user in the evening west of UTC.)
 */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Format a stored calendar-day Date for display, in UTC, so the rendered day
 * matches the day the user picked regardless of the viewer's timezone. Defaults
 * to "Jun 25"; pass options for a different style.
 */
export function formatCalendarDay(
  date: Date,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  return date.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

/** Like `formatCalendarDay` but takes an epoch-ms timestamp (for chart ticks). */
export function formatCalendarDayMs(
  t: number,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  return formatCalendarDay(new Date(t), opts);
}
