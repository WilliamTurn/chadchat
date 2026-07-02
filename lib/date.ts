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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The UTC calendar day a stored Date falls on, anchored at 00:00 UTC. The
 * lower bound for "that day" comparisons; pairs with the noon-UTC calendar-day
 * convention so a stored day never slips across the boundary.
 */
export function startOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/**
 * Start of "today" as a 00:00 UTC instant. The correct lower bound for
 * "today's ..." queries (meals, water) and for streak/week-strip day math: it
 * lines up with the noon-UTC calendar-day convention, so back-dated rows fall
 * in the right day regardless of the server's local timezone. Use this instead
 * of `new Date(); setHours(0, 0, 0, 0)`, which is the *server-local* day —
 * UTC on Vercel today, but silently wrong in any other runtime.
 */
export function startOfTodayUTC(): Date {
  return startOfDayUTC(new Date());
}

/**
 * Resolve a calendar-day range into a half-open [start, end) window of UTC
 * instants, suitable for `recordedAt >= start AND recordedAt < end` queries.
 *
 * - `start` / `end` are bare "YYYY-MM-DD" calendar days (the convention used
 *   everywhere a user picks a day — see `parseCalendarDay`).
 * - `start` omitted/unparseable → today's UTC day.
 * - `end` omitted → a single day (the `start` day).
 * - `end` before `start` → collapses to the single `start` day.
 *
 * The returned `end` is exclusive (start of the day *after* the last day in the
 * range), so callers use `< end` and never double-count the boundary instant.
 */
export function calendarRangeWindowUTC(
  start?: string | null,
  end?: string | null
): { start: Date; end: Date } {
  const startDay = startOfDayUTC(parseCalendarDay(start) ?? new Date());
  const endDayInclusive = startOfDayUTC(parseCalendarDay(end) ?? startDay);
  const lastDay =
    endDayInclusive.getTime() < startDay.getTime() ? startDay : endDayInclusive;
  return {
    start: startDay,
    // Exclusive upper bound: midnight UTC at the start of the next day.
    end: new Date(lastDay.getTime() + MS_PER_DAY),
  };
}

/* ------------------------------------------------------------------------
 * Per-user timezone (FEAT-8)
 *
 * The helpers above bucket by UTC day — right for *stored calendar days*
 * (anchored at noon UTC, they carry their day in their UTC Y-M-D), but wrong
 * for "which day is it for this user right now": a member in Chicago logging
 * at 8pm is still on *their* today even though the UTC day already rolled
 * over. These helpers answer day questions on the wall clock of the user's
 * stored IANA zone (`User.timezone`, captured silently from the browser).
 *
 * Two shapes, used together:
 *   - ANCHOR — `calendarDayAnchorInTz` / `todayAnchorInTz`: the calendar day
 *     an instant falls on in the user's zone, as a 00:00-UTC-anchored Date.
 *     Use for bucketing keys, streak math, week strips, and display (format
 *     with the UTC formatters above). Day arithmetic on anchors is plain
 *     `± MS_PER_DAY` — no DST landmines.
 *   - INSTANT — `startOfDayInTz` / `todayStartInTz`: the real UTC instant of
 *     the user's local midnight. Use as SQL bounds for "today's …" queries:
 *     the window contains both noon-UTC-anchored calendar rows for that local
 *     day (any zone within ±12h of UTC — the noon convention's buffer) and
 *     plain `now()` rows (water logs) the user created that local day.
 *
 * Everything falls back to America/New_York on a missing/invalid zone — the
 * user base is US lifters, and it matches the FEAT-11/12 email framing.
 * No deps; Intl only. Formatters are cached per zone (they're expensive to
 * construct and these run per-row when bucketing).
 * ---------------------------------------------------------------------- */

export const FALLBACK_TIMEZONE = "America/New_York";

/** True when `tz` is an IANA zone this runtime can actually resolve. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A usable IANA zone: the stored one if valid, else the US-Eastern fallback. */
export function resolveTimezone(tz: string | null | undefined): string {
  return tz && isValidTimezone(tz) ? tz : FALLBACK_TIMEZONE;
}

// One cached formatter per zone — construction is the expensive part.
const DAY_PART_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function dayPartsFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = DAY_PART_FORMATTERS.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    DAY_PART_FORMATTERS.set(tz, fmt);
  }
  return fmt;
}

/** The wall-clock reading of `instant` in `tz`, re-encoded as a UTC epoch. */
function wallClockAsUTC(instant: Date, tz: string): number {
  const parts = dayPartsFormatter(tz).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
}

/**
 * The calendar day `date` falls on, on the wall clock of the user's zone,
 * returned as that day anchored at 00:00 UTC (the same anchor shape the UTC
 * bucketing above and the chart day-keys use). This is THE bucketing function
 * for "which day does this row belong to, for this user".
 */
export function calendarDayAnchorInTz(
  date: Date,
  timezone: string | null | undefined
): Date {
  const wall = wallClockAsUTC(date, resolveTimezone(timezone));
  const d = new Date(wall);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Today's calendar day in the user's zone, as a 00:00-UTC anchor. */
export function todayAnchorInTz(timezone: string | null | undefined): Date {
  return calendarDayAnchorInTz(new Date(), timezone);
}

/**
 * The UTC instant when the wall clock in `tz` reads Y-M-D 00:00 (two-pass
 * offset derivation, so it's right across DST transitions; on a spring-forward
 * day whose midnight doesn't exist it lands on the first hour that does).
 */
function localMidnightInstant(
  y: number,
  monthIndex: number,
  d: number,
  tz: string
): Date {
  const target = Date.UTC(y, monthIndex, d);
  let guess = target - (wallClockAsUTC(new Date(target), tz) - target);
  guess = target - (wallClockAsUTC(new Date(guess), tz) - guess);
  return new Date(guess);
}

/**
 * The real UTC instant of the user's local midnight starting the local day
 * `date` falls in. The lower bound for "today's …" SQL queries — pairs with
 * `now` (or `+ MS_PER_DAY` for a full-day window) as the upper bound.
 */
export function startOfDayInTz(
  date: Date,
  timezone: string | null | undefined
): Date {
  const tz = resolveTimezone(timezone);
  const anchor = calendarDayAnchorInTz(date, tz);
  return localMidnightInstant(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth(),
    anchor.getUTCDate(),
    tz
  );
}

/** Start of the user's local today, as a real UTC instant (query lower bound). */
export function todayStartInTz(timezone: string | null | undefined): Date {
  return startOfDayInTz(new Date(), timezone);
}

/**
 * TZ-aware sibling of `calendarRangeWindowUTC`: resolve a picked calendar-day
 * range into [start, end) *instants* on the user's wall clock, so the window
 * catches both noon-UTC-anchored calendar rows and real logged-now timestamps
 * from those local days. Same conventions: omitted start → the user's today;
 * omitted/inverted end → a single day; `end` exclusive.
 */
export function calendarRangeWindowInTz(
  start: string | null | undefined,
  end: string | null | undefined,
  timezone: string | null | undefined
): { start: Date; end: Date } {
  const tz = resolveTimezone(timezone);
  const startAnchor = startOfDayUTC(parseCalendarDay(start) ?? todayAnchorInTz(tz));
  const endAnchorInclusive = startOfDayUTC(parseCalendarDay(end) ?? startAnchor);
  const lastAnchor =
    endAnchorInclusive.getTime() < startAnchor.getTime()
      ? startAnchor
      : endAnchorInclusive;
  const dayAfterLast = new Date(lastAnchor.getTime() + MS_PER_DAY);
  return {
    start: localMidnightInstant(
      startAnchor.getUTCFullYear(),
      startAnchor.getUTCMonth(),
      startAnchor.getUTCDate(),
      tz
    ),
    end: localMidnightInstant(
      dayAfterLast.getUTCFullYear(),
      dayAfterLast.getUTCMonth(),
      dayAfterLast.getUTCDate(),
      tz
    ),
  };
}

/**
 * Format an instant as a date on the user's wall clock ("what day is it for
 * them"). For stored noon-UTC calendar days keep using `formatCalendarDay` —
 * those carry their day in UTC by design.
 */
export function formatDayInTz(
  date: Date,
  timezone: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  return date.toLocaleDateString("en-US", {
    timeZone: resolveTimezone(timezone),
    ...opts,
  });
}
