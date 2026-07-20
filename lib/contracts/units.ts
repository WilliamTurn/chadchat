/**
 * UNIT CONTRACT (DSH-66 / Phase 1). The single registry of every unit a
 * dashboard number can carry, with one canonical formatter per unit and one
 * home for cross-unit conversion constants.
 *
 * Why this exists: the same quantity was being formatted differently on
 * different surfaces, and LB_PER_KG was independently declared in
 * `app/home/page.tsx`, `lib/ai/dashboard.ts`, and `lib/workouts/stats.ts`.
 * Any two declarations of the same constant will eventually disagree. From
 * Phase 2 on, new code imports conversions and formatting from here; the three
 * existing declarations migrate here as those files are touched (surgical
 * change rule: they are not edited in Phase 1).
 *
 * Display rules (approved audit copy system, doc 05):
 *   - A space separates number and unit: "2,300 kcal", "190 g", "20 oz",
 *     "208.8 lb", "36 in". Exception: compact duration tokens ("7h 30m") and
 *     chart axis ticks ("96oz") stay glued.
 *   - One spelling per concept per surface. Calories are ALWAYS "kcal" in data
 *     readouts; never mix "cal", "cals", "calories" as a unit token.
 *   - Values a member reads use tabular numerals (CSS `tabular-nums`) so
 *     columns of numbers align.
 *   - Converted values round once, at the display boundary, to the metric's
 *     declared precision. Never round intermediates (see `lib/chart/trend.ts`
 *     which already does this correctly).
 *
 * Hydration note: ml/oz conversion already has a canonical home in
 * `lib/today/water-units.ts` (storage is ml, display is oz/gal). This registry
 * re-exports it rather than declaring a second source of truth.
 */

import { formatOz, mlToOz, ozToMl } from "@/lib/today/water-units";

/** One pound per kilogram, the app-wide conversion constant. */
export const LB_PER_KG = 2.204_62;

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

/** Re-exported hydration conversions (canonical impl in lib/today/water-units). */
export { formatOz, mlToOz, ozToMl };

/** Every unit a registered metric may declare. */
export type UnitId =
  | "kcal"
  | "g" // grams (macros)
  | "oz" // US fluid ounces (hydration display)
  | "ml" // milliliters (hydration storage)
  | "lb"
  | "kg"
  | "in" // body measurements
  | "minutes" // sleep duration storage
  | "duration" // rendered "7h 30m"
  | "count" // meals, sets, exercises, workouts, PRs
  | "days"
  | "percent"
  | "score5"; // 1..5 quality ratings

export type UnitDef = {
  id: UnitId;
  /** The token rendered after the number ("kcal", "g", "oz"). */
  suffix: string;
  /** Space between number and suffix (false only for duration/axis tokens). */
  spaced: boolean;
  /** Default fraction digits at display time. */
  precision: 0 | 1;
  /** Plain-words meaning, for tooltips/help and the metric registry. */
  describes: string;
};

export const UNITS: Record<UnitId, UnitDef> = {
  kcal: {
    id: "kcal",
    suffix: "kcal",
    spaced: true,
    precision: 0,
    describes: "food energy",
  },
  g: {
    id: "g",
    suffix: "g",
    spaced: true,
    precision: 0,
    describes: "grams of a macronutrient",
  },
  oz: {
    id: "oz",
    suffix: "oz",
    spaced: true,
    precision: 0,
    describes: "US fluid ounces of water",
  },
  ml: {
    id: "ml",
    suffix: "ml",
    spaced: true,
    precision: 0,
    describes: "milliliters (storage only, never shown to members)",
  },
  lb: {
    id: "lb",
    suffix: "lb",
    spaced: true,
    precision: 1,
    describes: "pounds",
  },
  kg: {
    id: "kg",
    suffix: "kg",
    spaced: true,
    precision: 1,
    describes: "kilograms",
  },
  in: {
    id: "in",
    suffix: "in",
    spaced: true,
    precision: 1,
    describes: "inches (body measurements)",
  },
  minutes: {
    id: "minutes",
    suffix: "min",
    spaced: true,
    precision: 0,
    describes: "whole minutes (sleep storage; display as duration)",
  },
  duration: {
    id: "duration",
    suffix: "",
    spaced: false,
    precision: 0,
    describes: 'hours and minutes rendered "7h 30m"',
  },
  count: {
    id: "count",
    suffix: "",
    spaced: false,
    precision: 0,
    describes: "a plain count (meals, sets, workouts, records)",
  },
  days: {
    id: "days",
    suffix: "days",
    spaced: true,
    precision: 0,
    describes: "calendar days",
  },
  percent: {
    id: "percent",
    suffix: "%",
    spaced: false,
    precision: 0,
    describes: "share of a target or of logged days",
  },
  score5: {
    id: "score5",
    suffix: "/5",
    spaced: false,
    precision: 0,
    describes: "a 1 to 5 rating",
  },
};

/**
 * Canonical quantity formatter. "2,300 kcal", "208.8 lb", "64 oz", "85%",
 * "7h 30m" (via the duration branch). This is the ONE way a metric value
 * becomes a string; cards must not hand-roll `${value} ${unit}`.
 */
export function formatQuantity(value: number, unit: UnitId): string {
  if (unit === "duration") {
    return formatMinutesAsDuration(value);
  }
  const def = UNITS[unit];
  const n = value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: def.precision,
  });
  if (!def.suffix) {
    return n;
  }
  return def.spaced ? `${n} ${def.suffix}` : `${n}${def.suffix}`;
}

/** "7h 30m" / "45m" from whole minutes. Matches the sleep card's readout. */
export function formatMinutesAsDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) {
    return `${m}m`;
  }
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * "1,840 of 2,300 kcal" target readout. One phrasing everywhere; "of" (not a
 * slash) is the member-facing form per the approved copy system. Charts and
 * dense chips may use the slash form via `formatVsTargetCompact`.
 */
export function formatVsTarget(
  value: number,
  target: number,
  unit: UnitId
): string {
  if (unit === "duration") {
    return `${formatMinutesAsDuration(value)} of ${formatMinutesAsDuration(target)}`;
  }
  const def = UNITS[unit];
  const v = value.toLocaleString("en-US", {
    maximumFractionDigits: def.precision,
  });
  return `${v} of ${formatQuantity(target, unit)}`;
}

/** "1,840 / 2,300 kcal" for dense chips and chart captions. */
export function formatVsTargetCompact(
  value: number,
  target: number,
  unit: UnitId
): string {
  if (unit === "duration") {
    return `${formatMinutesAsDuration(value)} / ${formatMinutesAsDuration(target)}`;
  }
  const def = UNITS[unit];
  const v = value.toLocaleString("en-US", {
    maximumFractionDigits: def.precision,
  });
  return `${v} / ${formatQuantity(target, unit)}`;
}

/** Round to a metric's declared display precision, once, at the boundary. */
export function roundForDisplay(value: number, precision: 0 | 1): number {
  return precision === 0 ? Math.round(value) : Math.round(value * 10) / 10;
}
