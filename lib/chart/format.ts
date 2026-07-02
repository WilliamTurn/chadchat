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

/**
 * Round ascending y-axis ticks for a zero-based chart (VF-8): pick a clean
 * step, round the max UP to a whole step — never a raw data max like "4.4k" —
 * and return the explicit tick values. Include any target/goal in `peak` so
 * its line always sits inside the domain.
 *
 * `unit` makes the ticks round in the DISPLAY unit when data is stored in
 * another one (water: ml stored, oz shown → pass ML_PER_OZ; sleep: minutes
 * stored, hours shown → pass 60). `steps` overrides the 1/2/2.5/5 × 10ⁿ step
 * candidates (e.g. whole hours for sleep).
 */
export function niceScale(
  peak: number,
  opts: { maxIntervals?: number; unit?: number; steps?: number[] } = {}
): { max: number; ticks: number[] } {
  const unit = opts.unit ?? 1;
  const maxIntervals = opts.maxIntervals ?? 5;
  // 5% headroom so the tallest bar never touches the frame.
  const p = Math.max(peak / unit, 1e-9) * 1.05;

  const candidates =
    opts.steps ??
    (() => {
      const pow = 10 ** Math.floor(Math.log10(p / maxIntervals));
      return [1, 2, 2.5, 5, 10].map((m) => m * pow);
    })();

  let step = candidates[candidates.length - 1];
  for (const s of candidates) {
    if (Math.ceil(p / s) <= maxIntervals) {
      step = s;
      break;
    }
  }

  const intervals = Math.ceil(p / step);
  const ticks: number[] = [];
  for (let i = 0; i <= intervals; i++) {
    ticks.push(i * step * unit);
  }
  return { max: intervals * step * unit, ticks };
}
