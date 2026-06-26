/**
 * Pure macro math, shared by the server-side FDC enrichment and the client-side
 * plan editor (which re-scales a food's macros live when its grams change). No
 * "server-only" guard here on purpose — the editor is a client component.
 */

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Scale per-100g macros to a gram portion, rounded to clean display values. */
export function scaleMacros(per100g: Macros, grams: number): Macros {
  const f = Math.max(0, grams) / 100;
  return {
    calories: Math.round(per100g.calories * f),
    protein: Math.round(per100g.protein * f),
    carbs: Math.round(per100g.carbs * f),
    fat: Math.round(per100g.fat * f),
  };
}

/** Sum a list of macro objects into one total (rounded). */
export function sumMacros(list: Macros[]): Macros {
  const total = list.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return {
    calories: Math.round(total.calories),
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fat: Math.round(total.fat),
  };
}
