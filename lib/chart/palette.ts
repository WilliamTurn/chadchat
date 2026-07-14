/**
 * THE COLOR LAW (VF-7) — two rules every data visual in the app obeys:
 *
 *   1. RED is the brand and genuine alerts (over target, a true negative) —
 *      never ordinary data. The training charts (volume, est. 1RM) draw in
 *      blood because lifting IS the brand domain, not because red "means"
 *      anything about the numbers.
 *   2. EMERALD means moving toward / hitting a goal. The weight trend line is
 *      direction-colored (owner reversal, s138 / DSH-50: emerald toward goal,
 *      blood away, a deliberate neutral when ambiguous or no goal is set —
 *      the s126 "always emerald" call predated knowing this). Anything
 *      else that isn't a goal verdict draws in its domain accent below.
 *
 * This module is the single source of truth for every chart/data color.
 * The `--chart-1..5` tokens in `app/globals.css` mirror the five core hues —
 * keep them in sync if a hue ever changes. Chrome accents (icon chips, module
 * headers) live in `components/today/icon-chip.tsx` on the same hue families.
 */

/** Brand blood red: chrome, alerts, and the training domain. Same hex in
 *  both themes (7.8:1 on white), so it stays a literal. */
export const BLOOD = "#a4161a";

/** Emerald: "toward / at goal" verdicts, goal bars, goal lines, and the
 *  always-emerald weight trend line (rule 2). Theme-aware (FIX-19): light
 *  resolves to emerald-600, dark to emerald-500 (globals.css --chart-2). */
export const GOAL_EMERALD = "var(--chart-2)";

/** One fixed accent per domain. A chart's series color comes from here.
 *  Values are the --chart-N tokens (globals.css) so light gets the darker
 *  600-level fills that pass 3:1 on white cards (FIX-19) while dark keeps
 *  the 500s. SVG fill/stroke resolves var() fine; canvas/PDF renderers keep
 *  their own literals. */
export const DOMAIN = {
  /** Training volume + est. 1RM, the brand domain (see rule 1). Dark
   *  resolves one step brighter than brand chrome (3:1 fill law, FIX-19). */
  training: "var(--chart-5)",
  /** Water — sky. */
  hydration: "var(--chart-1)",
  /** Sleep — indigo. */
  sleep: "var(--chart-4)",
  /** Calories / nutrition — amber (never blood: a red calorie fill is
   *  indistinguishable from the genuine over-target alert). */
  nutrition: "var(--chart-3)",
} as const;

/**
 * Direction-verdict colors for trend lines (owner reversal s138 / DSH-50):
 * emerald toward the goal, blood away, a deliberate cool slate when there is
 * no goal or the window is flat. Centralized here (FIX-18) so the weight chart
 * and every future trend chart color the same verdict the same way.
 */
export const TREND_NEUTRAL = "var(--chart-neutral)";

export type TrendTone = "toward" | "away" | "neutral";

export const TREND_TONE: Record<TrendTone, string> = {
  toward: GOAL_EMERALD,
  away: DOMAIN.training,
  neutral: TREND_NEUTRAL,
};

/**
 * Reward-moment accents (the owner reward-glow direction, P5/P6; FIX-33).
 * Gold marks RECORD moments (the amber family: trophy chips, PR dots, the
 * celebration-hero wash); milestone moments stay on GOAL_EMERALD. Derived
 * with color-mix from the same tokens so glow and mark can never disagree.
 */
export const REWARD_GOLD = "var(--chart-3)";
export const REWARD_GOLD_WASH =
  "color-mix(in oklab, var(--chart-3) 14%, transparent)";

/** The macro trio (matches the MacroRings bars: sky / amber / violet).
 *  Theme-aware like DOMAIN (FIX-19). */
export const MACRO = {
  calories: DOMAIN.nutrition,
  protein: "var(--chart-protein)",
  carbs: "var(--chart-carbs)",
  fat: "var(--chart-fat)",
} as const;
