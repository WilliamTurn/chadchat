/**
 * THE COLOR LAW (VF-7) — two rules every data visual in the app obeys:
 *
 *   1. RED is the brand and genuine alerts (over target, a true negative) —
 *      never ordinary data. The training charts (volume, est. 1RM) draw in
 *      blood because lifting IS the brand domain, not because red "means"
 *      anything about the numbers.
 *   2. EMERALD means exactly one thing: moving toward / hitting a goal
 *      (the R2-10 weight-line treatment). Anything that isn't a goal verdict
 *      draws in its domain accent below, or stays neutral.
 *
 * This module is the single source of truth for every chart/data color.
 * The `--chart-1..5` tokens in `app/globals.css` mirror the five core hues —
 * keep them in sync if a hue ever changes. Chrome accents (icon chips, module
 * headers) live in `components/today/icon-chip.tsx` on the same hue families.
 */

/** Brand blood red — chrome, alerts, and the training domain. */
export const BLOOD = "#a4161a";

/** Emerald — strictly "toward / at goal": trend lines, goal bars, goal lines. */
export const GOAL_EMERALD = "#10b981";

/** Neutral data line (no goal, flat, or moving away — R2-10). */
export const NEUTRAL_LINE = "var(--foreground)";

/** One fixed accent per domain. A chart's series color comes from here. */
export const DOMAIN = {
  /** Training volume + est. 1RM — the brand domain (see rule 1). */
  training: BLOOD,
  /** Water — sky. */
  hydration: "#0ea5e9",
  /** Sleep — indigo. */
  sleep: "#818cf8",
  /** Calories / nutrition — amber (never blood: a red calorie fill is
   *  indistinguishable from the genuine over-target alert). */
  nutrition: "#f59e0b",
} as const;

/** The macro trio (matches the MacroRings bars: sky / amber / violet). */
export const MACRO = {
  calories: DOMAIN.nutrition,
  protein: "#38bdf8",
  carbs: "#fbbf24",
  fat: "#a78bfa",
} as const;
