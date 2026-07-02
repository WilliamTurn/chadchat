/**
 * Target arithmetic (R2-3): calories and macros are ONE equation, not four
 * independent numbers. Protein and carbs are 4 kcal per gram, fat is 9. Pure
 * math shared by the TargetEditor (client) and the save action's server-side
 * guard, so "100 calories with 900g protein" can never be stored.
 */

export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export type TargetGrams = {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export type TargetSplit = { protein: number; carbs: number; fat: number };

/** Calories implied by the entered macro grams (unset fields count as 0). */
export function macroCalories(g: TargetGrams): number {
  return Math.round(
    (g.protein ?? 0) * KCAL_PER_GRAM.protein +
      (g.carbs ?? 0) * KCAL_PER_GRAM.carbs +
      (g.fat ?? 0) * KCAL_PER_GRAM.fat
  );
}

/**
 * How far the macros may drift from the calorie target before we call it a
 * mismatch. Grams are whole numbers, so ~30 kcal of rounding slack is normal;
 * scale with the target so 3% of a big target isn't flagged either.
 */
export function calorieTolerance(calories: number): number {
  return Math.max(30, Math.round(calories * 0.03));
}

export type TargetVerdict =
  /** Nothing to reconcile: no macros entered. */
  | { kind: "none" }
  /** Macros entered but no calorie target; just state what they add up to. */
  | { kind: "info"; macroCal: number }
  /** Macros alone exceed the calorie target: physically impossible, block it. */
  | { kind: "impossible"; macroCal: number; overBy: number }
  /** All three macros set and they land within tolerance of the target. */
  | { kind: "match"; macroCal: number }
  /** All three macros set but they fall short of the target: warn, allow. */
  | { kind: "under"; macroCal: number; underBy: number }
  /** Only some macros set and they fit inside the target: fine. */
  | { kind: "partial"; macroCal: number };

/** Reconcile a calorie target against entered macro grams. */
export function reconcileTarget(
  calories: number | null,
  grams: TargetGrams
): TargetVerdict {
  const anyMacro =
    grams.protein != null || grams.carbs != null || grams.fat != null;
  if (!anyMacro) {
    return { kind: "none" };
  }
  const macroCal = macroCalories(grams);
  if (calories == null) {
    return { kind: "info", macroCal };
  }
  const tol = calorieTolerance(calories);
  if (macroCal > calories + tol) {
    return { kind: "impossible", macroCal, overBy: macroCal - calories };
  }
  const allSet =
    grams.protein != null && grams.carbs != null && grams.fat != null;
  if (!allSet) {
    return { kind: "partial", macroCal };
  }
  if (macroCal < calories - tol) {
    return { kind: "under", macroCal, underBy: calories - macroCal };
  }
  return { kind: "match", macroCal };
}

/** Derive macro grams from a calorie target and a percent split (sums to 100). */
export function gramsFromSplit(
  calories: number,
  split: TargetSplit
): { protein: number; carbs: number; fat: number } {
  return {
    protein: Math.round(
      (calories * split.protein) / 100 / KCAL_PER_GRAM.protein
    ),
    carbs: Math.round((calories * split.carbs) / 100 / KCAL_PER_GRAM.carbs),
    fat: Math.round((calories * split.fat) / 100 / KCAL_PER_GRAM.fat),
  };
}

/**
 * Back-derive a percent split from existing grams (to seed the percent tab).
 * Returns null unless all three grams are set and nonzero in total. Percents
 * are rounded to integers and nudged so they sum to exactly 100.
 */
export function splitFromGrams(g: TargetGrams): TargetSplit | null {
  if (g.protein == null || g.carbs == null || g.fat == null) {
    return null;
  }
  const cal = macroCalories(g);
  if (cal <= 0) {
    return null;
  }
  const protein = Math.round(((g.protein * KCAL_PER_GRAM.protein) / cal) * 100);
  const carbs = Math.round(((g.carbs * KCAL_PER_GRAM.carbs) / cal) * 100);
  // Absorb rounding drift into fat so the three always total 100.
  const fat = 100 - protein - carbs;
  if (fat < 0) {
    return null;
  }
  return { protein, carbs, fat };
}
