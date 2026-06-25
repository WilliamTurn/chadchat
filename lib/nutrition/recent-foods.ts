import type { MealAnalysis } from "@/lib/db/schema";
import type { MealCategory } from "@/lib/validation/nutrition";

/**
 * A distinct food the user has logged before, ready to re-log in one tap —
 * the "Recent" list every food tracker (MFP/MacroFactor) leads with so you
 * never retype "chicken, rice & broccoli" and its macros again.
 */
export type RecentFood = {
  title: string;
  meal: MealCategory | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const round = (n: number | null) => (n == null ? null : Math.round(n));

/**
 * Collapse a newest-first meal log into the most recent distinct foods.
 * Dedupes case-insensitively by title (keeping the newest entry's macros) and
 * drops entries with no macros at all (nothing useful to re-log). The caller
 * already pulls a generous recent window, so this needs no extra query.
 */
export function deriveRecentFoods(
  meals: MealAnalysis[],
  limit = 15
): RecentFood[] {
  const seen = new Set<string>();
  const out: RecentFood[] = [];
  for (const m of meals) {
    const key = m.title.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    const hasMacro =
      m.calories != null ||
      m.protein != null ||
      m.carbs != null ||
      m.fat != null;
    if (!hasMacro) {
      continue;
    }
    seen.add(key);
    out.push({
      title: m.title,
      meal: (m.meal as MealCategory | null) ?? null,
      calories: round(m.calories),
      protein: round(m.protein),
      carbs: round(m.carbs),
      fat: round(m.fat),
    });
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

/** "520 kcal · 40g P · 55g C · 18g F" — omits any macro that wasn't logged. */
export function formatMacroSummary(food: RecentFood): string {
  const parts: string[] = [];
  if (food.calories != null) {
    parts.push(`${food.calories} kcal`);
  }
  if (food.protein != null) {
    parts.push(`${food.protein}g P`);
  }
  if (food.carbs != null) {
    parts.push(`${food.carbs}g C`);
  }
  if (food.fat != null) {
    parts.push(`${food.fat}g F`);
  }
  return parts.join(" · ");
}
