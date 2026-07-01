// Pure scheduling math for the weekly report (FEAT-12). The cron runs HOURLY;
// each pass asks, per member: "in YOUR timezone, is it your chosen report day,
// at or past your chosen hour?" — so everyone gets their report in their own
// local evening (or whenever they picked), not at one fixed UTC instant.
// No "server-only": these are pure functions, unit-tested in tests/unit.

/** Sunday 5pm local — the classic "Sunday Report" default. */
export const DEFAULT_REPORT_DAY = 0;
export const DEFAULT_REPORT_HOUR = 17;

// Until FEAT-8 captures a timezone at login, members who never saved a report
// schedule have timezone=null; assume US Eastern (the user base is US lifters,
// and it matches the fixed ~ET framing the FEAT-11 check-in crons already use).
export const FALLBACK_TIMEZONE = "America/New_York";

/** Day-of-week options for the /account schedule picker (0 = Sunday). */
export const REPORT_DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function reportDayLabel(day: number): string {
  return (
    REPORT_DAY_OPTIONS.find((d) => d.value === day)?.label ?? "Sunday"
  );
}

/** 17 → "5:00 PM", 0 → "12:00 AM" — how the hour picker shows each choice. */
export function formatReportHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 ? "AM" : "PM"}`;
}

/** True when `tz` is an IANA zone this runtime can actually resolve. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * The weekday (0=Sunday…6=Saturday) and hour (0-23) of `date` as seen on a
 * wall clock in `timezone`. Falls back to FALLBACK_TIMEZONE when the zone is
 * missing or unresolvable (a bad stored value must never crash the cron pass).
 */
export function localDayHour(
  date: Date,
  timezone: string | null | undefined
): { day: number; hour: number } {
  const tz =
    timezone && isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return { day: WEEKDAY_INDEX[weekday] ?? 0, hour };
}

/**
 * Is this member's report due right now? True on their chosen local day at or
 * AFTER their chosen hour — ">=" (not "===") so a delayed or skipped cron run
 * still delivers later the same day instead of silently skipping a week. The
 * once-per-week dedup lives in the ledger check, not here.
 */
export function isReportDue(
  now: Date,
  prefs: {
    weeklyReportDay: number;
    weeklyReportHour: number;
    timezone: string | null;
  }
): boolean {
  const { day, hour } = localDayHour(now, prefs.timezone);
  return day === prefs.weeklyReportDay && hour >= prefs.weeklyReportHour;
}
