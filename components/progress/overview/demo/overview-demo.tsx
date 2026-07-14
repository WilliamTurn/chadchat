/**
 * Fixture-harness view models for the Progress overview (FIX-32, P56-A):
 * the deterministic personas pushed through the SAME pure computation
 * modules the live page uses (lib/progress/overview.ts, lib/chart/trend.ts,
 * lib/workouts/stats.ts), so the harness proves the real math and the real
 * section components across every persona state.
 */

import type {
  BodySectionVM,
  ConsistencySectionVM,
  GoalSectionVM,
  HydrationSectionVM,
  MilestoneSectionVM,
  NutritionSectionVM,
  ReportsSectionVM,
  SleepSectionVM,
  TrainingSectionVM,
} from "@/components/progress/overview/sections";
import { formatShortDate, formatSignedDelta } from "@/lib/chart/format";
import { ema, MS_PER_DAY, round1 } from "@/lib/chart/trend";
import {
  clampToWindow,
  toDaySlots,
  toWeekSlots,
  windowEndingAt,
} from "@/lib/chart/window";
import { isGoalReached } from "@/lib/contracts/claims";
import { formatCoverage } from "@/lib/contracts/data-state";
import {
  formatMinutesAsDuration,
  formatQuantity,
} from "@/lib/contracts/units";
import { calendarDayAnchorInTz } from "@/lib/date";
import { computeGoalProgress } from "@/lib/goals/progress";
import {
  consistencyWindow,
  hydrationWindow,
  nutritionAdherenceWindow,
  sleepWindow,
  windowDayAnchorsMs,
} from "@/lib/progress/overview";
import { mlToOz } from "@/lib/today/water-units";
import { computeStreak } from "@/lib/today/streak";
import { canonicalizeWorkouts } from "@/lib/workouts/exercise-identity";
import { computePersonalRecords } from "@/lib/workouts/stats";
import {
  FIXTURE_TIMEZONE,
  fixtureDayAnchorMs,
  type Persona,
} from "@/tests/fixtures/dashboard-states";

const DEMO_DAYS = 30;
const DEMO_LABEL = "last 30 days";
const CONSISTENCY_DAYS = 84;

export type OverviewDemoVMs = {
  body: BodySectionVM;
  training: TrainingSectionVM;
  nutrition: NutritionSectionVM;
  sleep: SleepSectionVM;
  hydration: HydrationSectionVM;
  consistency: ConsistencySectionVM;
  milestone: MilestoneSectionVM;
  reports: ReportsSectionVM;
  goal: GoalSectionVM | null;
};

export function buildOverviewDemoVMs(persona: Persona): OverviewDemoVMs {
  const locked = persona.tier === "basic";
  const todayMs = fixtureDayAnchorMs(0);
  const window = windowEndingAt(todayMs, DEMO_DAYS);
  const anchorsMs = windowDayAnchorsMs(todayMs, DEMO_DAYS);

  /* body */
  const points = persona.weighIns.map((w) => ({ t: w.t, value: w.weight }));
  const allRows = ema(
    points.map((p) => ({ t: p.t, weight: p.value })),
    10
  );
  const windowRows = clampToWindow(allRows, window);
  const inWindow = points.filter(
    (p) => p.t >= window.startMs && p.t <= window.endMs
  );
  const coverage = {
    loggedDays: new Set(inWindow.map((p) => Math.floor(p.t / MS_PER_DAY))).size,
    windowDays: window.days,
    points: inWindow.length,
    spanDays:
      inWindow.length >= 2
        ? Math.round((inWindow[inWindow.length - 1].t - inWindow[0].t) / MS_PER_DAY)
        : 0,
  };
  const trendCurrent =
    allRows.length > 0 ? round1(allRows[allRows.length - 1].trend) : null;
  const goalWeight = persona.goal?.targetValue ?? null;
  const ageDays =
    points.length > 0
      ? Math.max(
          0,
          Math.floor((todayMs - points[points.length - 1].t) / MS_PER_DAY)
        )
      : 0;
  let tone: BodySectionVM["tone"] = "neutral";
  let changeText: string | null = null;
  if (windowRows.length >= 2) {
    const change = round1(
      windowRows[windowRows.length - 1].trend - windowRows[0].trend
    );
    changeText = `${formatSignedDelta(change, "lb")} · ${DEMO_LABEL}`;
    if (goalWeight != null && Math.abs(change) >= 0.2) {
      tone =
        (change < 0) === (goalWeight < windowRows[0].trend) ? "toward" : "away";
    }
  }
  const progress = computeGoalProgress({
    startValue: persona.goal?.startValue ?? null,
    targetValue: goalWeight,
    current: trendCurrent,
    firstWeight: points[0]?.value ?? null,
  });
  const reached =
    goalWeight != null &&
    trendCurrent != null &&
    isGoalReached(
      persona.goal?.startValue ?? trendCurrent,
      goalWeight,
      trendCurrent
    );

  const body: BodySectionVM = {
    state: locked
      ? "locked"
      : points.length === 0
        ? "empty"
        : ageDays > 10
          ? "stale"
          : points.length < 3
            ? "sparse"
            : "populated",
    headline: trendCurrent != null ? formatQuantity(trendCurrent, "lb") : null,
    changeText,
    goalText:
      goalWeight == null
        ? null
        : reached
          ? `Goal ${goalWeight} lb · reached`
          : progress
            ? `Goal ${goalWeight} lb · ${Math.min(99, Math.round(progress.pct))}% there`
            : `Goal ${goalWeight} lb`,
    tone,
    points,
    window,
    unit: "lb",
    goalWeight,
    coverageText: formatCoverage(coverage),
  };

  /* training */
  const canonical = canonicalizeWorkouts(persona.workouts, {
    memberCustomNames: [],
    memberAliases: new Map(),
  });
  const sessionAnchors = canonical.map((w) =>
    calendarDayAnchorInTz(new Date(w.performedAt), FIXTURE_TIMEZONE).getTime()
  );
  const records = computePersonalRecords(canonical);
  const lastSessionMs =
    sessionAnchors.length > 0 ? Math.max(...sessionAnchors) : null;
  const sessionsThisWeek = sessionAnchors.filter(
    (t) => t > todayMs - 7 * MS_PER_DAY
  ).length;
  const sessionsInWindow = sessionAnchors.filter(
    (t) => t >= window.startMs && t <= window.endMs
  ).length;
  const training: TrainingSectionVM = {
    state: locked
      ? "locked"
      : canonical.length === 0
        ? "empty"
        : lastSessionMs != null && todayMs - lastSessionMs > 14 * MS_PER_DAY
          ? "stale"
          : "populated",
    headline: `${sessionsThisWeek} session${sessionsThisWeek === 1 ? "" : "s"} this week`,
    context:
      records.length > 0
        ? `${records.length} personal record${records.length === 1 ? "" : "s"}`
        : null,
    weekSlots: toWeekSlots(
      window,
      sessionAnchors.map((t) => ({ t }))
    ),
    target: null,
    coverageText: `${sessionsInWindow} session${sessionsInWindow === 1 ? "" : "s"} · ${DEMO_LABEL}`,
  };

  /* nutrition (fixture meals lack DB row fields, so the day roll-up is done
     here with the same recordedAt member-local-day bucketing dailyMacroTrend
     applies; the grading below is the shared nutritionAdherenceWindow) */
  const caloriesByDayMap = new Map<number, number>();
  for (const m of persona.meals) {
    const t = calendarDayAnchorInTz(m.recordedAt, FIXTURE_TIMEZONE).getTime();
    caloriesByDayMap.set(t, (caloriesByDayMap.get(t) ?? 0) + m.calories);
  }
  const macroDays = [...caloriesByDayMap.entries()]
    .map(([t, calories]) => ({ t, calories }))
    .sort((a, b) => a.t - b.t);
  const nutritionSummary = nutritionAdherenceWindow({
    dayAnchorsMs: anchorsMs,
    caloriesByDay: new Map(macroDays.map((d) => [d.t, d.calories] as const)),
    targetByDay: new Map(
      anchorsMs.map(
        (t) => [t, persona.nutritionTarget?.calories ?? null] as const
      )
    ),
  });
  const nutrition: NutritionSectionVM = {
    state: locked
      ? "locked"
      : nutritionSummary.loggedDays === 0
        ? "empty"
        : nutritionSummary.loggedDays < 2
          ? "sparse"
          : "populated",
    headline:
      nutritionSummary.gradableDays > 0
        ? `${nutritionSummary.daysAtTarget} of ${nutritionSummary.gradableDays} days within target`
        : `${nutritionSummary.loggedDays} day${nutritionSummary.loggedDays === 1 ? "" : "s"} logged`,
    context:
      nutritionSummary.average != null
        ? `avg ${formatQuantity(Math.round(nutritionSummary.average), "kcal")} · ${DEMO_LABEL} · calendar shows the last 28 days`
        : DEMO_LABEL,
    cells: nutritionSummary.days.slice(-28).map((d) => ({
      t: d.t,
      level:
        d.status === "hit"
          ? 0
          : d.status === "missed"
            ? 1
            : d.status === "logged"
              ? 2
              : null,
    })),
    todayMs,
  };

  /* sleep */
  const sleepSummary = sleepWindow({
    dayAnchorsMs: anchorsMs,
    minutesByDay: new Map(
      persona.sleepDaily
        .filter((d) => d.t >= window.startMs && d.t <= window.endMs)
        .map((d) => [d.t, d.minutes] as const)
    ),
    goalMinutesByDay: new Map(
      anchorsMs.map((t) => [t, persona.sleepGoalMinutes] as const)
    ),
  });
  const sleep: SleepSectionVM = {
    state: locked
      ? "locked"
      : sleepSummary.loggedDays === 0
        ? "empty"
        : sleepSummary.loggedDays < 2
          ? "sparse"
          : "populated",
    headline:
      sleepSummary.average != null
        ? `${formatMinutesAsDuration(Math.round(sleepSummary.average))} average`
        : "Not logged",
    context:
      sleepSummary.gradableDays > 0
        ? `${sleepSummary.daysAtTarget} of ${sleepSummary.gradableDays} nights at goal · last 14 nights shown`
        : "last 14 nights shown",
    slots: toDaySlots(
      windowEndingAt(todayMs, 14),
      persona.sleepDaily.map((d) => ({ t: d.t, value: d.minutes }))
    ),
    target:
      persona.sleepGoalMinutes != null
        ? {
            value: persona.sleepGoalMinutes,
            label: `Goal ${formatMinutesAsDuration(persona.sleepGoalMinutes)}`,
            direction: "atLeast",
          }
        : null,
  };

  /* hydration */
  const hydrationSummary = hydrationWindow({
    dayAnchorsMs: anchorsMs,
    mlByDay: new Map(
      persona.waterDaily
        .filter((d) => d.t >= window.startMs && d.t <= window.endMs)
        .map((d) => [d.t, d.ml] as const)
    ),
    goalMlByDay: new Map(
      anchorsMs.map((t) => [t, persona.waterGoalMl] as const)
    ),
  });
  const hydration: HydrationSectionVM = {
    state: locked
      ? "locked"
      : hydrationSummary.loggedDays === 0
        ? "empty"
        : hydrationSummary.loggedDays < 2
          ? "sparse"
          : "populated",
    headline:
      hydrationSummary.gradableDays > 0
        ? `${hydrationSummary.daysAtTarget} of ${hydrationSummary.gradableDays} days at goal`
        : `${hydrationSummary.loggedDays} day${hydrationSummary.loggedDays === 1 ? "" : "s"} logged`,
    context: DEMO_LABEL,
    fraction:
      hydrationSummary.gradableDays > 0
        ? hydrationSummary.daysAtTarget / hydrationSummary.gradableDays
        : null,
    centerValue:
      hydrationSummary.average != null
        ? formatQuantity(Math.round(mlToOz(hydrationSummary.average)), "oz")
        : null,
  };

  /* consistency */
  const consistencyAnchors = windowDayAnchorsMs(todayMs, CONSISTENCY_DAYS);
  const cw = consistencyWindow({
    dayAnchorsMs: consistencyAnchors,
    domainDays: [
      new Set(macroDays.map((d) => d.t)),
      new Set(sessionAnchors),
      new Set(persona.waterDaily.map((d) => d.t)),
      new Set(persona.sleepDaily.map((d) => d.t)),
      new Set(persona.weighIns.map((w) => w.t)),
    ],
  });
  const activityDates = cw.days
    .filter((d) => d.domains > 0)
    .map((d) => new Date(d.t + 18 * 60 * 60 * 1000));
  const streak = computeStreak(activityDates, FIXTURE_TIMEZONE);
  const consistency: ConsistencySectionVM = {
    state: locked ? "locked" : cw.loggedDays === 0 ? "empty" : "populated",
    headline: streak > 0 ? `${streak} day streak` : "No active streak",
    context: `${cw.loggedDays} of ${CONSISTENCY_DAYS} days logged · last 12 weeks`,
    cells: cw.days.map((d) => ({
      t: d.t,
      level: d.domains > 0 ? d.domains : null,
    })),
    maxLevel: 4,
    todayMs,
    glowing: streak > 0,
  };

  /* milestone */
  const latestRecord =
    records.length > 0
      ? records.reduce((a, b) =>
          new Date(a.lastPerformed).getTime() >=
          new Date(b.lastPerformed).getTime()
            ? a
            : b
        )
      : null;
  const milestone: MilestoneSectionVM = {
    state: locked ? "locked" : latestRecord ? "populated" : "empty",
    headline: latestRecord
      ? `${latestRecord.exerciseName} record`
      : "No milestones yet",
    detail: latestRecord
      ? `${latestRecord.bestEst1RM} ${latestRecord.est1RMUnit} est. 1RM · ${formatShortDate(new Date(latestRecord.lastPerformed).getTime())}`
      : null,
    nextText:
      streak > 0 ? `Next up: a 7-day streak (you're at ${streak}).` : null,
  };

  /* reports (personas carry no reports; elite renders the designed empty) */
  const reports: ReportsSectionVM = {
    state: persona.tier === "elite" ? "empty" : "locked",
    headline: "No report yet",
    context: null,
  };

  /* goal (legacy weight goal, adapted exactly like the live resolver) */
  const goal: GoalSectionVM | null = persona.goal
    ? {
        id: "fixture-goal",
        title: persona.goal.title,
        headline: reached
          ? "Reached"
          : progress
            ? `${Math.min(99, Math.round(progress.pct))}% there`
            : "1 outcome tracked",
        outcomes: [
          {
            label: "Trend weight",
            supported: true,
            currentText:
              trendCurrent != null ? `${trendCurrent} lb` : null,
            targetText: `${persona.goal.targetValue} lb`,
            fraction: progress ? Math.min(1, progress.pct / 100) : null,
            reached,
          },
        ],
        state: "populated",
      }
    : null;

  return {
    body,
    training,
    nutrition,
    sleep,
    hydration,
    consistency,
    milestone,
    reports,
    goal,
  };
}
