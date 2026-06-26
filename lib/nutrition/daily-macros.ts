/**
 * Roll a meal log up into per-day macro totals for the nutrition trend chart.
 * Pure (no DB/React) so it's unit-testable and usable server- or client-side.
 *
 * Each meal counts toward its **effective day** — the user-picked `recordedAt`
 * if it was back-dated, else its insert time (`createdAt`), matching the same
 * `recordedAt ?? createdAt` convention the diary uses everywhere. Days are
 * bucketed by **UTC** calendar day (and keyed to that day's midnight-UTC ms) so
 * the chart's ticks/tooltips never shift across a timezone — the systemic UTC
 * convention (see `lib/date.ts`). Result is oldest-first.
 */

import type { MealAnalysis } from "@/lib/db/schema";

export type DailyMacros = {
  t: number; // midnight UTC of the day, ms
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** The day a meal is logged for — its picked date, or its insert time. */
function mealDay(m: MealAnalysis): Date {
  return m.recordedAt ?? m.createdAt;
}

function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function dailyMacroTrend(meals: MealAnalysis[]): DailyMacros[] {
  const byDay = new Map<number, DailyMacros>();
  for (const m of meals) {
    const t = utcDayMs(mealDay(m));
    const row = byDay.get(t) ?? {
      t,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    row.calories += m.calories ?? 0;
    row.protein += m.protein ?? 0;
    row.carbs += m.carbs ?? 0;
    row.fat += m.fat ?? 0;
    byDay.set(t, row);
  }
  return [...byDay.values()]
    .map((r) => ({
      t: r.t,
      calories: Math.round(r.calories),
      protein: Math.round(r.protein),
      carbs: Math.round(r.carbs),
      fat: Math.round(r.fat),
    }))
    .sort((a, b) => a.t - b.t);
}
