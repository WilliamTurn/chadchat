/**
 * Shared shape + portion math for food-database search results (FN-1).
 * No "server-only" guard on purpose: the Search tab (a client component)
 * previews and logs portions with the SAME arithmetic the server uses, so the
 * number the member sees is exactly the number that lands in the diary.
 */

import type { Macros } from "./macros";

/** One food the member can portion and log, from any verified source. */
export type FoodHit = {
  /** Stable identity for client keys: "table:name" | "fdc:id" | "off:code". */
  id: string;
  /** Display name ("Chicken breast", "Protein Shake"). */
  name: string;
  /** Brand for packaged foods, null for whole foods. */
  brand: string | null;
  /** Verified macros per 100 g (null only when a barcode product publishes
   *  per-serving data without a gram weight). */
  per100g: Macros | null;
  /** The product's labeled serving, when known. */
  serving: { label: string; grams: number | null; macros: Macros } | null;
  /** Where the numbers come from - shown so members know the data is real. */
  source: "table" | "usda" | "off";
};

export type PortionUnit = "g" | "oz" | "serving";

export const OZ_IN_GRAMS = 28.3495;

/**
 * Exact macros for a chosen portion, rounded to the integers the diary
 * stores. Null when the amount is unusable or the food lacks the data that
 * unit needs (no per-100g for grams/oz, no labeled serving for servings).
 */
export function portionMacros(
  hit: FoodHit,
  amount: number,
  unit: PortionUnit
): Macros | null {
  if (!(Number.isFinite(amount) && amount > 0)) {
    return null;
  }
  if (unit === "serving") {
    if (!hit.serving) {
      return null;
    }
    const m = hit.serving.macros;
    return {
      calories: Math.round(m.calories * amount),
      protein: Math.round(m.protein * amount),
      carbs: Math.round(m.carbs * amount),
      fat: Math.round(m.fat * amount),
    };
  }
  if (!hit.per100g) {
    return null;
  }
  const grams = unit === "oz" ? amount * OZ_IN_GRAMS : amount;
  const f = grams / 100;
  return {
    calories: Math.round(hit.per100g.calories * f),
    protein: Math.round(hit.per100g.protein * f),
    carbs: Math.round(hit.per100g.carbs * f),
    fat: Math.round(hit.per100g.fat * f),
  };
}

/** Human portion text for the diary title: "170 g", "6 oz", "2 servings". */
export function portionLabel(amount: number, unit: PortionUnit): string {
  if (unit === "serving") {
    return amount === 1 ? "1 serving" : `${amount} servings`;
  }
  return `${amount} ${unit}`;
}
