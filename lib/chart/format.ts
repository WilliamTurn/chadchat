/**
 * Shared chart formatters. All date helpers route through `formatCalendarDayMs`
 * (UTC-stable) so ticks/tooltips never shift a day by the viewer's timezone —
 * the systemic UTC bug we keep fixed everywhere (see `lib/date.ts`).
 */

import { round1 } from "@/lib/chart/trend";
import { formatCalendarDayMs } from "@/lib/date";

/** Short axis tick, e.g. "May 18". */
export function formatTick(t: number): string {
  return formatCalendarDayMs(t);
}

/** Full tooltip / projection date, e.g. "May 18, 2026". */
export function formatFullDate(t: number): string {
  return formatCalendarDayMs(t, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact projection date, e.g. "Sep 14". */
export function formatShortDate(t: number): string {
  return formatCalendarDayMs(t, { month: "short", day: "numeric" });
}

/**
 * Signed delta with unit and a real minus glyph, e.g. "+1.2 lb" / "−3.4 lb".
 * Returns "0 {unit}" (no sign) for a zero change.
 */
export function formatSignedDelta(n: number, unit: string): string {
  const r = round1(n);
  const sign = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${sign}${Math.abs(r)} ${unit}`;
}

/** Per-week rate, e.g. "−0.8 lb/wk". */
export function formatRate(perWeek: number, unit: string): string {
  return `${formatSignedDelta(perWeek, unit)}/wk`;
}
