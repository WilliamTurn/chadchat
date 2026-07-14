import type { HydrationPanelDay } from "@/components/today/hydration-panel";
import type { NutritionPanelDay } from "@/components/today/nutrition-panel";
import type { SleepPanelNight } from "@/components/today/sleep-panel";
import type { LastNight } from "@/lib/today/week";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";
import {
  FIXTURE_TIMEZONE,
  fixtureDayAnchorMs,
  fixtureInstant,
  type Persona,
} from "@/tests/fixtures/dashboard-states";

/**
 * FIXTURE ADAPTERS for the P56-C tracking panels (FIX-25/26/27): map the six
 * deterministic personas onto the exact prop shapes the REAL panels take, so
 * the harness renders the shipping components, never lookalike demos. All
 * day math is hand-anchored to the fixture week (today = Wed 2026-07-08,
 * America/Chicago; offsets 3..-3 are Su..Sa), mirroring
 * components/panels/demo/panel-demos.tsx: the runtime weekAnchors helper
 * reads the real clock and would break determinism here.
 *
 * Fixture targets are static, so every day's FIX-07 effective-dated target
 * resolves to the persona's one target; the live pages get true per-day
 * resolution from lib/today/panel-data.ts.
 */

const DAY_MS = 86_400_000;

/** This fixture week, Sunday-start (today = Wed Jul 8): offsets 3..-3. */
const WEEK_OFFSETS = [3, 2, 1, 0, -1, -2, -3] as const;
const WEEK_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function weekDateLabel(offset: number): string {
  return fixtureInstant(offset).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: FIXTURE_TIMEZONE,
  });
}

/**
 * Day-offset bucketing for BOTH anchors and mid-day instants: the day whose
 * [anchor, anchor+24h) window contains `ms`. (A plain round() shifts an
 * 18:00Z fixture instant onto the next day; fixture instants sit at 1pm CDT,
 * so UTC-day windows equal the member-local day here.)
 */
function daysAgoOf(ms: number): number {
  return Math.floor((fixtureDayAnchorMs(0) + DAY_MS - 1 - ms) / DAY_MS);
}

export function fixtureHydrationProps(persona: Persona): {
  totalMl: number;
  goalMl: number;
  week: HydrationPanelDay[];
} {
  const byDay = new Map(persona.waterDaily.map((w) => [w.t, w.ml] as const));
  const week = WEEK_OFFSETS.map((offset, i) => {
    const t = fixtureDayAnchorMs(offset);
    const ml = byDay.get(t);
    return {
      t,
      label: WEEK_LABELS[i],
      dateLabel: weekDateLabel(offset),
      ml: ml ?? 0,
      logged: ml != null,
      isToday: offset === 0,
      isFuture: offset < 0,
      goalMl: persona.waterGoalMl,
    };
  });
  return {
    totalMl: byDay.get(fixtureDayAnchorMs(0)) ?? 0,
    goalMl: persona.waterGoalMl,
    week,
  };
}

export function fixtureSleepProps(persona: Persona): {
  lastNight: LastNight;
  goalMinutes: number;
  isDefaultGoal: boolean;
  week: SleepPanelNight[];
} {
  const goalMinutes = persona.sleepGoalMinutes ?? SLEEP_GOAL_MINUTES;
  const byDay = new Map(persona.sleepDaily.map((s) => [s.t, s] as const));
  const week = WEEK_OFFSETS.map((offset, i) => {
    const t = fixtureDayAnchorMs(offset);
    const entry = byDay.get(t);
    return {
      t,
      iso: new Date(t).toISOString().slice(0, 10),
      label: WEEK_LABELS[i],
      dateLabel: weekDateLabel(offset),
      minutes: entry?.minutes ?? 0,
      quality: entry?.quality ?? null,
      logged: entry != null,
      isToday: offset === 0,
      isFuture: offset < 0,
      goalMinutes,
    };
  });
  const latest =
    persona.sleepDaily.length > 0
      ? persona.sleepDaily.reduce((a, b) => (a.t > b.t ? a : b))
      : null;
  const lastNight: LastNight = latest
    ? {
        minutes: latest.minutes,
        quality: latest.quality,
        isCurrent: daysAgoOf(latest.t) <= 1,
        dateLabel: weekDateLabel(daysAgoOf(latest.t)),
        ageDays: daysAgoOf(latest.t),
      }
    : null;
  return {
    lastNight,
    goalMinutes,
    isDefaultGoal: persona.sleepGoalMinutes == null,
    week,
  };
}

export function fixtureNutritionProps(persona: Persona): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsToday: number;
  target: NutritionPanelDay["target"];
  week: NutritionPanelDay[];
} {
  const target: NutritionPanelDay["target"] = persona.nutritionTarget
    ? {
        calories: persona.nutritionTarget.calories,
        protein: persona.nutritionTarget.protein,
        carbs: null,
        fat: null,
      }
    : null;
  const byDay = new Map<
    number,
    { calories: number; protein: number; carbs: number; fat: number; meals: number }
  >();
  for (const m of persona.meals) {
    const t = fixtureDayAnchorMs(daysAgoOf(m.recordedAt.getTime()));
    const row =
      byDay.get(t) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
    row.calories += m.calories;
    row.protein += m.protein;
    row.carbs += m.carbs;
    row.fat += m.fat;
    row.meals += 1;
    byDay.set(t, row);
  }
  const week = WEEK_OFFSETS.map((offset, i) => {
    const t = fixtureDayAnchorMs(offset);
    const row = byDay.get(t);
    return {
      t,
      label: WEEK_LABELS[i],
      dateLabel: weekDateLabel(offset),
      calories: Math.round(row?.calories ?? 0),
      protein: Math.round(row?.protein ?? 0),
      carbs: Math.round(row?.carbs ?? 0),
      fat: Math.round(row?.fat ?? 0),
      logged: row != null,
      isToday: offset === 0,
      isFuture: offset < 0,
      target,
    };
  });
  const today = byDay.get(fixtureDayAnchorMs(0));
  return {
    calories: Math.round(today?.calories ?? 0),
    protein: Math.round(today?.protein ?? 0),
    carbs: Math.round(today?.carbs ?? 0),
    fat: Math.round(today?.fat ?? 0),
    mealsToday: today?.meals ?? 0,
    target,
    week,
  };
}
