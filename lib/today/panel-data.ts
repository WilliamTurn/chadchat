import "server-only";

import {
  calendarDayAnchorInTz,
  calendarRangeWindowInTz,
  toCalendarDayISO,
  todayStartInTz,
} from "@/lib/date";
import {
  getLatestSleepEntry,
  getMealsSince,
  getNutritionTargetsByDay,
  getSleepDailyTotals,
  getSleepGoalMinutesByDay,
  getWaterDailyTotals,
  getWaterGoalMlByDay,
  getWaterMlSince,
  type NutritionTargetValues,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { dailyMacroTrend } from "@/lib/nutrition/daily-macros";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/today/water-units";
import {
  buildLastNight,
  buildMacroWeek,
  buildSleepWeek,
  buildWaterWeek,
  type LastNight,
  type MacroDay,
  type SleepNight,
  type WaterDay,
  weekAnchors,
} from "@/lib/today/week";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";

/**
 * CANONICAL PANEL-DATA ASSEMBLERS (P56-C, FIX-25/26/27). One server-side
 * assembler per Today tracking panel, so every mount (app/today/page.tsx, the
 * domain detail pages, the fixture harness' live checks) feeds the SAME
 * values through the SAME queries: the one-canonical-value law at the data
 * layer, not just the display layer.
 *
 * Targets resolve through the FIX-07 effective-dated read APIs
 * (getNutritionTargetsByDay / getWaterGoalMlByDay / getSleepGoalMinutesByDay),
 * NEVER the raw current-pointer rows: each week-strip day grades against the
 * target that was active ON THAT DAY, so a backfilled log lands under the
 * right goal and a target change never rewrites the week behind it.
 *
 * Callers gate on tier BEFORE calling (these fetch member data); the panels
 * themselves render the locked state without data.
 */

/** A hydration week day carrying the goal active on that day (FIX-07). */
export type HydrationWeekDay = WaterDay & { goalMl: number };

export type HydrationPanelData = {
  /** Today's logged total (ml). */
  totalMl: number;
  /** The goal active today (ml), effective-dated. */
  goalMl: number;
  /** Sunday-start current week, each day with its own effective goal. */
  week: HydrationWeekDay[];
};

export async function getHydrationPanelData(
  user: User
): Promise<HydrationPanelData> {
  const timezone = user.timezone;
  const { days, todayMs } = weekAnchors(timezone);
  const [totalMl, waterDaily, goalsByDay] = await Promise.all([
    getWaterMlSince(user.id, todayStartInTz(timezone)),
    getWaterDailyTotals(user.id, timezone),
    getWaterGoalMlByDay(user.id, days),
  ]);
  const week = buildWaterWeek(waterDaily, timezone).map((day, i) => ({
    ...day,
    goalMl: goalsByDay[i] ?? DEFAULT_WATER_GOAL_ML,
  }));
  const todayIdx = days.findIndex((d) => d.getTime() === todayMs);
  return {
    totalMl,
    goalMl: goalsByDay[todayIdx] ?? DEFAULT_WATER_GOAL_ML,
    week,
  };
}

/** A sleep week night carrying the goal active on that night (FIX-07). */
export type SleepWeekNight = SleepNight & { goalMinutes: number };

export type SleepPanelData = {
  /** The latest entry, honestly framed (isCurrent only for today/yesterday). */
  lastNight: LastNight;
  /** The goal active today (minutes), effective-dated. */
  goalMinutes: number;
  /** Whether the member has ever customized the goal (footer wording). */
  isDefaultGoal: boolean;
  /** Sunday-start current week, each night with its own effective goal. */
  week: SleepWeekNight[];
};

export async function getSleepPanelData(user: User): Promise<SleepPanelData> {
  const timezone = user.timezone;
  const { days, todayMs } = weekAnchors(timezone);
  const [latest, sleepDaily, goalsByDay] = await Promise.all([
    getLatestSleepEntry(user.id),
    getSleepDailyTotals(user.id, timezone),
    getSleepGoalMinutesByDay(user.id, days),
  ]);
  const week = buildSleepWeek(sleepDaily, timezone).map((night, i) => ({
    ...night,
    goalMinutes: goalsByDay[i] ?? SLEEP_GOAL_MINUTES,
  }));
  const todayIdx = days.findIndex((d) => d.getTime() === todayMs);
  const todayGoal = goalsByDay[todayIdx];
  return {
    lastNight: buildLastNight(latest, timezone),
    goalMinutes: todayGoal ?? SLEEP_GOAL_MINUTES,
    isDefaultGoal: todayGoal == null,
    week,
  };
}

/** A nutrition week day carrying the target active on that day (FIX-07). */
export type NutritionWeekDay = MacroDay & {
  target: NutritionTargetValues | null;
};

export type NutritionPanelData = {
  /** Today's logged totals (0s only when meals exist; see mealsToday). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Meals logged today; 0 means today's totals are UNLOGGED, not zero. */
  mealsToday: number;
  /** The target active today, effective-dated; null = no target set. */
  target: NutritionTargetValues | null;
  /** Sunday-start current week, each day with its own effective target. */
  week: NutritionWeekDay[];
};

export async function getNutritionPanelData(
  user: User
): Promise<NutritionPanelData> {
  const timezone = user.timezone;
  const { days, todayMs } = weekAnchors(timezone);
  // The exact instant the member's local week began (DST-safe), for the
  // meals query bound; day bucketing then runs on local calendar days.
  const weekStart = calendarRangeWindowInTz(
    toCalendarDayISO(days[0]),
    toCalendarDayISO(days[days.length - 1]),
    timezone
  ).start;
  const [meals, targetsByDay] = await Promise.all([
    getMealsSince(user.id, weekStart),
    getNutritionTargetsByDay(user.id, days),
  ]);
  const daily = dailyMacroTrend(meals, timezone);
  const week = buildMacroWeek(daily, timezone).map((day, i) => ({
    ...day,
    target: targetsByDay[i] ?? null,
  }));
  const todayIdx = days.findIndex((d) => d.getTime() === todayMs);
  const today = week[todayIdx];
  return {
    calories: today?.calories ?? 0,
    protein: today?.protein ?? 0,
    carbs: today?.carbs ?? 0,
    fat: today?.fat ?? 0,
    // Same effective-day bucketing as dailyMacroTrend (recordedAt ?? createdAt
    // on the member's local calendar day), so the count and the totals agree.
    mealsToday: meals.filter(
      (m) =>
        calendarDayAnchorInTz(m.recordedAt ?? m.createdAt, timezone).getTime() ===
        todayMs
    ).length,
    target: targetsByDay[todayIdx] ?? null,
    week,
  };
}
