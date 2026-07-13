import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { ProgressSkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import {
  BodySection,
  type BodySectionVM,
  ConsistencySection,
  GoalSection,
  type GoalSectionVM,
  GoalsEmptySection,
  HydrationSection,
  MilestoneSection,
  NutritionSection,
  OverviewBand,
  ReportsSection,
  SleepSection,
  TrainingSection,
} from "@/components/progress/overview/sections";
import {
  OverviewRangeControl,
  QuickAddMenu,
} from "@/components/progress/overview/overview-controls";
import {
  OVERVIEW_RANGE_DAYS,
  OVERVIEW_RANGE_LABEL,
  type OverviewRangeKey,
  parseOverviewRange,
} from "@/components/progress/overview/range";
import {
  canAccessChad,
  canAccessEliteFeatures,
  canAccessProFeatures,
} from "@/lib/admin";
import { formatShortDate, formatSignedDelta } from "@/lib/chart/format";
import { ema, MS_PER_DAY, round1 as roundTrend } from "@/lib/chart/trend";
import {
  clampToWindow,
  toDaySlots,
  toWeekSlots,
  windowEndingAt,
} from "@/lib/chart/window";
import { formatCoverage } from "@/lib/contracts/data-state";
import { canClaimForMetric } from "@/lib/contracts/metrics";
import {
  formatMinutesAsDuration,
  formatQuantity,
} from "@/lib/contracts/units";
import { calendarDayAnchorInTz, todayAnchorInTz } from "@/lib/date";
import {
  getActiveGoalsByUserId,
  getActivityDaysSince,
  getBodyMeasurementsByUserId,
  getLatestWeeklyReport,
  getMealsSince,
  getNutritionTargetsByDay,
  getProgressEntriesByUserId,
  getSleepDailyTotals,
  getSleepGoalMinutesByDay,
  getUserById,
  getWaterDailyTotals,
  getWaterGoalMlByDay,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import { getOutcomesForGoals } from "@/lib/db/plan-goal-queries";
import type { Goal, User } from "@/lib/db/schema";
import { computeGoalProgress } from "@/lib/goals/progress";
import { isGoalReached } from "@/lib/contracts/claims";
import { resolveGoalOutcomes } from "@/lib/goals/outcomes";
import { dailyMacroTrend } from "@/lib/nutrition/daily-macros";
import {
  consistencyWindow,
  hydrationWindow,
  nutritionAdherenceWindow,
  sleepWindow,
  windowDayAnchorsMs,
} from "@/lib/progress/overview";
import {
  convertWeight,
  parseWeightUnit,
  round1,
  weightGoalStart,
  weightGoalTarget,
} from "@/lib/progress/weight";
import { getApprovedExerciseAliases } from "@/lib/workouts/alias-queries";
import {
  canonicalizeWorkouts,
} from "@/lib/workouts/exercise-identity";
import { getCustomExercisesByUserId } from "@/lib/db/queries";
import {
  computePersonalRecords,
  exercise1RMTrend,
  type WorkoutData,
} from "@/lib/workouts/stats";
import { toWorkoutData } from "@/lib/workouts/serialize";
import { DEFAULT_WATER_GOAL_ML, mlToOz } from "@/lib/today/water-units";
import { computeStreak } from "@/lib/today/streak";
import { weekAnchors } from "@/lib/today/week";

/** The consistency calendar's fixed window (engagement.consistency.window). */
const CONSISTENCY_DAYS = 84;

/** Streak lookback, matching /today exactly (one canonical streak). */
const ACTIVITY_LOOKBACK_DAYS = 120;

/** Workout history depth for records/frequency (matches /workouts). */
const MAX_WORKOUTS = 400;

/** Streak milestone thresholds for the "next milestone" line. */
const STREAK_MILESTONES = [7, 14, 30, 60, 90, 180, 365];

/**
 * FIX-32 (DEC-02): the cross-domain Progress overview. Nine sections, each
 * visible or explicitly empty/locked, never silently absent; every displayed
 * number is a registered metric computed in its one source module.
 */
export default async function ProgressOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseOverviewRange((await searchParams).range);

  return (
    <PageShell active="/progress" className="max-w-[var(--container-content)]">
      <Toaster position="top-center" richColors theme="system" />

      <div className="mb-8">
        <BackToDashboard />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="font-semibold text-2xl tracking-tight">Progress</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Your outcomes across every domain, in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <OverviewRangeControl active={range} />
            <QuickAddMenu />
            <AskChadButton prompt="Review my progress across every domain: body, training, nutrition, sleep, hydration, and consistency. Where am I winning and where am I slipping?" />
          </div>
        </div>
      </div>

      <Suspense fallback={<ProgressSkeleton />}>
        <OverviewContent range={range} />
      </Suspense>
    </PageShell>
  );
}

async function OverviewContent({ range }: { range: OverviewRangeKey }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  const isPro = canAccessProFeatures(user);
  const isElite = canAccessEliteFeatures(user);
  const timezone = user.timezone;
  const todayMs = todayAnchorInTz(timezone).getTime();
  const days = OVERVIEW_RANGE_DAYS[range];
  const windowLabel = OVERVIEW_RANGE_LABEL[range];
  const window = windowEndingAt(todayMs, days);
  const anchorsMs = windowDayAnchorsMs(todayMs, days);
  const anchors = anchorsMs.map((t) => new Date(t));
  const fetchDays = Math.max(days, CONSISTENCY_DAYS);
  const fetchSince = new Date(todayMs - (fetchDays - 1) * MS_PER_DAY);
  const activitySince = new Date(
    todayMs - ACTIVITY_LOOKBACK_DAYS * MS_PER_DAY
  );

  const [
    entries,
    goals,
    rawWorkouts,
    customs,
    memberAliases,
    meals,
    nutritionTargets,
    waterDaily,
    waterGoals,
    sleepDaily,
    sleepGoals,
    activityDays,
    latestReport,
    measurements,
  ] = await Promise.all([
    isPro ? getProgressEntriesByUserId(user.id) : Promise.resolve([]),
    getActiveGoalsByUserId(user.id),
    isPro ? getWorkoutsByUserId(user.id, MAX_WORKOUTS) : Promise.resolve([]),
    isPro ? getCustomExercisesByUserId(user.id) : Promise.resolve([]),
    isPro
      ? getApprovedExerciseAliases(user.id)
      : Promise.resolve(new Map<string, string>()),
    isPro ? getMealsSince(user.id, fetchSince) : Promise.resolve([]),
    isPro ? getNutritionTargetsByDay(user.id, anchors) : Promise.resolve([]),
    isPro
      ? getWaterDailyTotals(user.id, timezone, fetchDays)
      : Promise.resolve([]),
    isPro ? getWaterGoalMlByDay(user.id, anchors) : Promise.resolve([]),
    isPro
      ? getSleepDailyTotals(user.id, timezone, fetchDays)
      : Promise.resolve([]),
    isPro ? getSleepGoalMinutesByDay(user.id, anchors) : Promise.resolve([]),
    isPro
      ? getActivityDaysSince(user.id, activitySince)
      : Promise.resolve<Date[]>([]),
    isElite ? getLatestWeeklyReport(user.id) : Promise.resolve(null),
    isPro ? getBodyMeasurementsByUserId(user.id) : Promise.resolve([]),
  ]);

  const workouts = rawWorkouts.map(toWorkoutData);
  const canonicalWorkouts = canonicalizeWorkouts(workouts, {
    memberCustomNames: customs.map((c) => c.name),
    memberAliases,
  });

  /* ------------------------------------------------------------- body VM */
  const displayUnit: "lb" | "kg" = user.weightUnit ?? "lb";
  const weighed = entries.filter((e) => e.weight != null);
  const points = weighed.map((e) => ({
    t: e.recordedAt.getTime(),
    value: round1(convertWeight(e.weight as number, e.unit, displayUnit)),
  }));
  const allRows = ema(
    points.map((p) => ({ t: p.t, weight: p.value })),
    10
  );
  const bodyWindowRows = clampToWindow(allRows, window);
  const bodyInWindow = points.filter(
    (p) => p.t >= window.startMs && p.t <= window.endMs
  );
  const bodyCoverage = {
    loggedDays: new Set(bodyInWindow.map((p) => Math.floor(p.t / MS_PER_DAY)))
      .size,
    windowDays: window.days,
    points: bodyInWindow.length,
    spanDays:
      bodyInWindow.length >= 2
        ? Math.round(
            (bodyInWindow[bodyInWindow.length - 1].t - bodyInWindow[0].t) /
              MS_PER_DAY
          )
        : 0,
  };
  const goalWeight = weightGoalTarget(goals, displayUnit);
  const goalStart = weightGoalStart(goals, displayUnit);
  const trendCurrent =
    allRows.length > 0 ? roundTrend(allRows[allRows.length - 1].trend) : null;
  const bodyAgeDays =
    points.length > 0
      ? Math.max(
          0,
          Math.floor((todayMs - points[points.length - 1].t) / MS_PER_DAY)
        )
      : 0;

  let bodyTone: BodySectionVM["tone"] = "neutral";
  let bodyChangeText: string | null = null;
  if (bodyWindowRows.length >= 2) {
    const change = roundTrend(
      bodyWindowRows[bodyWindowRows.length - 1].trend - bodyWindowRows[0].trend
    );
    const claim = canClaimForMetric(
      "body.weight.trend",
      "trend-direction",
      bodyCoverage
    );
    if (claim.allowed) {
      bodyChangeText = `${formatSignedDelta(change, displayUnit)} · ${windowLabel}`;
      if (goalWeight != null && Math.abs(change) >= 0.2) {
        bodyTone =
          (change < 0) === (goalWeight < bodyWindowRows[0].trend)
            ? "toward"
            : "away";
      }
    }
  }
  const bodyProgress = computeGoalProgress({
    startValue: goalStart,
    targetValue: goalWeight,
    current: trendCurrent,
    firstWeight: points[0]?.value ?? null,
  });
  const bodyReached =
    goalWeight != null &&
    trendCurrent != null &&
    isGoalReached(goalStart ?? trendCurrent, goalWeight, trendCurrent);
  const bodyGoalText =
    goalWeight == null
      ? null
      : bodyReached
        ? `Goal ${goalWeight} ${displayUnit} · reached`
        : bodyProgress
          ? `Goal ${goalWeight} ${displayUnit} · ${Math.min(99, Math.round(bodyProgress.pct))}% there`
          : `Goal ${goalWeight} ${displayUnit}`;

  const bodyVM: BodySectionVM = {
    state: !isPro
      ? "locked"
      : points.length === 0
        ? "empty"
        : bodyAgeDays > 10
          ? "stale"
          : points.length < 3
            ? "sparse"
            : "populated",
    headline:
      trendCurrent != null
        ? formatQuantity(trendCurrent, displayUnit)
        : null,
    changeText: bodyChangeText,
    goalText: bodyGoalText,
    tone: bodyTone,
    points,
    window,
    unit: displayUnit,
    goalWeight,
    coverageText: formatCoverage(bodyCoverage),
  };

  /* --------------------------------------------------------- training VM */
  const weekStartMs = weekAnchors(timezone).days[0].getTime();
  const sessionAnchors = canonicalWorkouts.map((w) =>
    calendarDayAnchorInTz(new Date(w.performedAt), timezone).getTime()
  );
  const sessionsThisWeek = sessionAnchors.filter(
    (t) => t >= weekStartMs
  ).length;
  const weekSlots = toWeekSlots(
    window,
    sessionAnchors.map((t) => ({ t }))
  );
  const records = computePersonalRecords(canonicalWorkouts);
  const sessionsInWindow = sessionAnchors.filter(
    (t) => t >= window.startMs && t <= window.endMs
  ).length;
  const lastSessionMs =
    sessionAnchors.length > 0 ? Math.max(...sessionAnchors) : null;
  const trainingStale =
    lastSessionMs != null && todayMs - lastSessionMs > 14 * MS_PER_DAY;

  const trainingVM = {
    state: !isPro
      ? ("locked" as const)
      : canonicalWorkouts.length === 0
        ? ("empty" as const)
        : trainingStale
          ? ("stale" as const)
          : ("populated" as const),
    headline: `${sessionsThisWeek} session${sessionsThisWeek === 1 ? "" : "s"} this week`,
    context:
      records.length > 0
        ? `${records.length} personal record${records.length === 1 ? "" : "s"}`
        : null,
    weekSlots,
    target: null,
    coverageText: `${sessionsInWindow} session${sessionsInWindow === 1 ? "" : "s"} · ${windowLabel}`,
  };

  /* -------------------------------------------------------- nutrition VM */
  const macroDays = dailyMacroTrend(meals, timezone);
  const caloriesByDay = new Map(
    macroDays.map((d) => [d.t, d.calories] as const)
  );
  const nutritionTargetByDay = new Map(
    anchorsMs.map((t, i) => {
      const target = nutritionTargets[i];
      return [t, target ? (target.calories ?? null) : null] as const;
    })
  );
  const nutrition = nutritionAdherenceWindow({
    dayAnchorsMs: anchorsMs,
    caloriesByDay,
    targetByDay: nutritionTargetByDay,
  });
  const nutritionCells = nutrition.days.slice(-28).map((d) => ({
    t: d.t,
    level:
      d.status === "hit"
        ? 0
        : d.status === "missed"
          ? 1
          : d.status === "logged"
            ? 2
            : null,
  }));
  const nutritionVM = {
    state: !isPro
      ? ("locked" as const)
      : nutrition.loggedDays === 0
        ? ("empty" as const)
        : nutrition.loggedDays < 2
          ? ("sparse" as const)
          : ("populated" as const),
    headline:
      nutrition.gradableDays > 0
        ? `${nutrition.daysAtTarget} of ${nutrition.gradableDays} days within target`
        : `${nutrition.loggedDays} day${nutrition.loggedDays === 1 ? "" : "s"} logged`,
    context: [
      nutrition.average != null
        ? `avg ${formatQuantity(Math.round(nutrition.average), "kcal")}`
        : null,
      days > 28 ? "last 28 days shown" : windowLabel,
    ]
      .filter(Boolean)
      .join(" · "),
    cells: nutritionCells,
    todayMs,
  };

  /* -------------------------------------------------------- hydration VM */
  const mlByDay = new Map(
    waterDaily
      .filter((d) => d.t >= window.startMs && d.t <= window.endMs)
      .map((d) => [d.t, d.ml] as const)
  );
  // No goal ever set = the registry default (one US gallon), the same
  // fallback /hydration applies; a day is only ungradable when the member
  // deliberately cleared the goal for that day.
  const waterGoalByDay = new Map(
    anchorsMs.map(
      (t, i) => [t, waterGoals[i] ?? DEFAULT_WATER_GOAL_ML] as const
    )
  );
  const hydration = hydrationWindow({
    dayAnchorsMs: anchorsMs,
    mlByDay,
    goalMlByDay: waterGoalByDay,
  });
  const hydrationVM = {
    state: !isPro
      ? ("locked" as const)
      : hydration.loggedDays === 0
        ? ("empty" as const)
        : hydration.loggedDays < 2
          ? ("sparse" as const)
          : ("populated" as const),
    headline:
      hydration.gradableDays > 0
        ? `${hydration.daysAtTarget} of ${hydration.gradableDays} days at goal`
        : `${hydration.loggedDays} day${hydration.loggedDays === 1 ? "" : "s"} logged`,
    context: windowLabel,
    fraction:
      hydration.gradableDays > 0
        ? hydration.daysAtTarget / hydration.gradableDays
        : null,
    centerValue:
      hydration.average != null
        ? formatQuantity(Math.round(mlToOz(hydration.average)), "oz")
        : null,
  };

  /* ------------------------------------------------------------ sleep VM */
  const minutesByDay = new Map(
    sleepDaily
      .filter((d) => d.t >= window.startMs && d.t <= window.endMs)
      .map((d) => [d.t, d.minutes] as const)
  );
  const sleepGoalByDay = new Map(
    anchorsMs.map((t, i) => [t, sleepGoals[i] ?? null] as const)
  );
  const sleep = sleepWindow({
    dayAnchorsMs: anchorsMs,
    minutesByDay,
    goalMinutesByDay: sleepGoalByDay,
  });
  const sleepSlotWindow = windowEndingAt(todayMs, Math.min(days, 14));
  const sleepSlots = toDaySlots(
    sleepSlotWindow,
    sleepDaily.map((d) => ({ t: d.t, value: d.minutes }))
  );
  const sleepGoalNow = user.sleepGoalMinutes ?? null;
  const sleepVM = {
    state: !isPro
      ? ("locked" as const)
      : sleep.loggedDays === 0
        ? ("empty" as const)
        : sleep.loggedDays < 2
          ? ("sparse" as const)
          : ("populated" as const),
    headline:
      sleep.average != null
        ? `${formatMinutesAsDuration(Math.round(sleep.average))} average`
        : "Not logged",
    context: [
      sleep.gradableDays > 0
        ? `${sleep.daysAtTarget} of ${sleep.gradableDays} nights at goal`
        : null,
      days > 14 ? "last 14 nights shown" : windowLabel,
    ]
      .filter(Boolean)
      .join(" · "),
    slots: sleepSlots,
    target:
      sleepGoalNow != null
        ? {
            value: sleepGoalNow,
            label: `Goal ${formatMinutesAsDuration(sleepGoalNow)}`,
            direction: "atLeast" as const,
          }
        : null,
  };

  /* ------------------------------------------------------ consistency VM */
  const consistencyAnchors = windowDayAnchorsMs(todayMs, CONSISTENCY_DAYS);
  const dayAnchorSet = (ts: number[]) => new Set(ts);
  const consistency = consistencyWindow({
    dayAnchorsMs: consistencyAnchors,
    domainDays: [
      dayAnchorSet(macroDays.map((d) => d.t)),
      dayAnchorSet(sessionAnchors),
      dayAnchorSet(waterDaily.map((d) => d.t)),
      dayAnchorSet(sleepDaily.map((d) => d.t)),
      dayAnchorSet(
        entries.map((e) =>
          calendarDayAnchorInTz(e.recordedAt, timezone).getTime()
        )
      ),
    ],
  });
  const streak = computeStreak(activityDays, timezone);
  const consistencyVM = {
    state: !isPro
      ? ("locked" as const)
      : consistency.loggedDays === 0
        ? ("empty" as const)
        : ("populated" as const),
    headline:
      streak > 0 ? `${streak} day streak` : "No active streak",
    context: `${consistency.loggedDays} of ${CONSISTENCY_DAYS} days logged · last 12 weeks`,
    cells: consistency.days.map((d) => ({
      t: d.t,
      level: d.domains > 0 ? d.domains : null,
    })),
    maxLevel: 4,
    todayMs,
    glowing: streak > 0,
  };

  /* -------------------------------------------------------- milestone VM */
  const latestRecord =
    records.length > 0
      ? records.reduce((a, b) =>
          new Date(a.lastPerformed).getTime() >=
          new Date(b.lastPerformed).getTime()
            ? a
            : b
        )
      : null;
  const nextStreakMilestone = STREAK_MILESTONES.find((m) => m > streak);
  const milestoneVM = {
    state: !isPro
      ? ("locked" as const)
      : latestRecord
        ? ("populated" as const)
        : ("empty" as const),
    headline: latestRecord
      ? `${latestRecord.exerciseName} record`
      : "No milestones yet",
    detail: latestRecord
      ? `${latestRecord.bestEst1RM} ${latestRecord.est1RMUnit} est. 1RM · ${formatShortDate(new Date(latestRecord.lastPerformed).getTime())}`
      : null,
    nextText:
      streak > 0 && nextStreakMilestone
        ? `Next up: a ${nextStreakMilestone}-day streak (you're at ${streak}).`
        : null,
  };

  /* ---------------------------------------------------------- reports VM */
  const reportsVM = {
    state: !isElite
      ? ("locked" as const)
      : latestReport
        ? ("populated" as const)
        : ("empty" as const),
    headline: latestReport
      ? `Sent ${formatShortDate(latestReport.sentAt.getTime())}`
      : "No report yet",
    context: latestReport ? latestReport.subject : null,
  };

  /* ------------------------------------------------------------ goals VM */
  const outcomesByGoal = await getOutcomesForGoals({
    goalIds: goals.map((g) => g.id),
    userId: user.id,
  });
  const latestMeasurementByKind = new Map<string, number>();
  for (const m of measurements) {
    if (!latestMeasurementByKind.has(m.kind)) {
      latestMeasurementByKind.set(m.kind, m.value);
    }
  }
  const goalVMs = goals
    .slice(0, 3)
    .map((g) =>
      buildGoalVM(
        g,
        outcomesByGoal.get(g.id) ?? [],
        {
          trendWeight: trendCurrent,
          trendUnit: displayUnit,
          canonicalWorkouts,
          latestMeasurementByKind,
        }
      )
    );

  return (
    <div className="grid-dashboard">
      {/* 1. Goal progress */}
      <OverviewBand title="Goals">
        {goals.length > 3 && (
          <a
            className="text-body-sm text-muted-foreground underline-offset-4 hover:underline"
            href="/goals"
          >
            All goals ({goals.length})
          </a>
        )}
      </OverviewBand>
      {goalVMs.length > 0 ? (
        goalVMs.map((vm) => (
          <div className="col-span-4" key={vm.id}>
            <GoalSection vm={vm} />
          </div>
        ))
      ) : (
        <div className="col-span-4">
          <GoalsEmptySection />
        </div>
      )}

      {/* 2 + 3. Body and Training: the rich outcome pair */}
      <OverviewBand title="Outcomes" />
      <div className="col-span-4 md:col-span-8 xl:col-span-6">
        <BodySection vm={bodyVM} />
      </div>
      <div className="col-span-4 md:col-span-8 xl:col-span-6">
        <TrainingSection vm={trainingVM} />
      </div>

      {/* 4 + 5 + 6. The daily-input domains */}
      <OverviewBand title="Daily habits" />
      <div className="col-span-4 md:col-span-4 xl:col-span-4">
        <NutritionSection vm={nutritionVM} />
      </div>
      <div className="col-span-4 md:col-span-4 xl:col-span-4">
        <SleepSection vm={sleepVM} />
      </div>
      <div className="col-span-4 md:col-span-4 xl:col-span-4">
        <HydrationSection vm={hydrationVM} />
      </div>

      {/* 7 + 8 + 9. Consistency, rewards, and the weekly review */}
      <OverviewBand title="Consistency and review" />
      <div className="col-span-4 md:col-span-8 xl:col-span-4">
        <ConsistencySection vm={consistencyVM} />
      </div>
      <div className="col-span-4 md:col-span-4 xl:col-span-4">
        <MilestoneSection vm={milestoneVM} />
      </div>
      <div className="col-span-4 md:col-span-4 xl:col-span-4">
        <ReportsSection vm={reportsVM} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------- goal outcome values */

function buildGoalVM(
  goal: Goal,
  outcomeRows: Parameters<typeof resolveGoalOutcomes>[1],
  sources: {
    trendWeight: number | null;
    trendUnit: "lb" | "kg";
    canonicalWorkouts: WorkoutData[];
    latestMeasurementByKind: Map<string, number>;
  }
): GoalSectionVM {
  const outcomes = resolveGoalOutcomes(goal, outcomeRows).map((o) => {
    // Supported outcomes read their metric's ONE source module; unsupported
    // outcomes show the member-maintained value, labeled (FIX-29).
    let current: number | null = null;
    if (!o.supported) {
      current = o.currentValue;
    } else if (o.metricId === "body.weight.trend") {
      current =
        sources.trendWeight != null
          ? round1(
              convertWeight(
                sources.trendWeight,
                sources.trendUnit,
                parseWeightUnit(o.unit)
              )
            )
          : null;
    } else if (o.metricId === "training.exercise.e1rm" && o.metricRef) {
      const trend = exercise1RMTrend(sources.canonicalWorkouts, o.metricRef);
      current = trend.length > 0 ? trend[trend.length - 1].value : null;
    } else if (o.metricId === "body.measurement" && o.metricRef) {
      current =
        sources.latestMeasurementByKind.get(o.metricRef.toLowerCase()) ?? null;
    }

    const progress = computeGoalProgress({
      startValue: o.startValue,
      targetValue: o.targetValue,
      current,
    });
    const reached =
      current != null &&
      o.targetValue != null &&
      isGoalReached(o.startValue ?? current, o.targetValue, current);

    const unitSuffix = o.unit ? ` ${o.unit}` : "";
    return {
      label: o.label,
      supported: o.supported,
      currentText: current != null ? `${round1(current)}${unitSuffix}` : null,
      targetText:
        o.targetValue != null ? `${o.targetValue}${unitSuffix}` : null,
      fraction: progress ? Math.min(1, progress.pct / 100) : null,
      reached,
    };
  });

  const primary = outcomes[0];
  const headline = primary?.reached
    ? "Reached"
    : primary?.fraction != null
      ? `${Math.min(99, Math.round(primary.fraction * 100))}% there`
      : `${outcomes.length || "No"} outcome${outcomes.length === 1 ? "" : "s"} tracked`;

  return {
    id: goal.id,
    title: goal.title,
    headline,
    outcomes,
    state: outcomes.length === 0 ? "empty" : "populated",
  };
}
