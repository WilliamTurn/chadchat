import {
  ArrowRight,
  ChefHat,
  Droplet,
  Dumbbell,
  LineChart,
  Lock,
  Moon,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { RewardProvider } from "@/components/dashboard/reward";
import { PageShell } from "@/components/nav/page-shell";
import { MacroRings } from "@/components/nutrition/macro-rings";
import { WeightChartInteractive } from "@/components/progress/weight-chart-interactive";
import type { DayBar, SparkPoint } from "@/components/panels/visuals";
import {
  ConsistencyPanel,
  type ConsistencyDomainRow,
} from "@/components/today/consistency-panel";
import type { LiftProgress } from "@/components/today/goal-list";
import { GoalList } from "@/components/today/goal-list";
import { HydrationPanel } from "@/components/today/hydration-panel";
import {
  ModuleCard,
  ModuleFooter,
  ModuleHeader,
} from "@/components/today/module-card";
import { PlanList } from "@/components/today/plan-list";
import { SectionBand } from "@/components/today/section-band";
import { SleepTracker } from "@/components/today/sleep-tracker";
import { StatusStrip } from "@/components/today/status-strip";
import { TargetEditor } from "@/components/today/target-editor";
import { PlanBadge, TodayHeader } from "@/components/today/today-header";
import { UpNextPanel } from "@/components/today/up-next-panel";
import { WeekStrip } from "@/components/today/week-strip";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { sumMacros } from "@/lib/ai/dashboard";
import { ema } from "@/lib/chart/trend";
import { LB_PER_KG } from "@/lib/contracts/units";
import {
  calendarDayAnchorInTz,
  formatCalendarDay,
  formatDayInTz,
  formatDayInTzSmartYear,
  toCalendarDayISO,
  todayAnchorInTz,
  todayStartInTz,
} from "@/lib/date";
import {
  getPlanSessionCompletions,
  resolvePlanScheduleView,
} from "@/lib/db/plan-goal-queries";
import {
  getActiveGoalsByUserId,
  getActiveMealPlanByUserId,
  getActivePlansByUserId,
  getActivityDaysSince,
  getInactiveGoalsByUserId,
  getInactivePlansByUserId,
  getLatestSleepEntry,
  getMealsSince,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getSleepDailyTotals,
  getUserById,
  getUserMemory,
  getWaterDailyTotals,
  getWaterMlSince,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import type { ProgressEntry } from "@/lib/db/schema";
import { findCalorieConflict, findOverlapIds } from "@/lib/goals/coherence";
import { clientField } from "@/lib/memory/client-field";
import { weeklyPlanAdherence } from "@/lib/plans/adherence";
import type { CompletionEvent } from "@/lib/plans/up-next";
import { selectUpNextSession } from "@/lib/plans/up-next";
import { toPlanStatusSummary } from "@/lib/subscription";
import { computeStreak } from "@/lib/today/streak";
import { selectUpNextToday, type UpNextSnapshot } from "@/lib/today/up-next";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/today/water-units";
import {
  buildLastNight,
  buildSleepWeek,
  buildWaterWeek,
  buildWorkoutWeek,
  weekAnchors,
  weekSlotDateLabel,
  weekSlotLabel,
} from "@/lib/today/week";
import { cn } from "@/lib/utils";
import { toWorkoutData } from "@/lib/workouts/serialize";
import { exercise1RMTrend, workoutVolumeLb } from "@/lib/workouts/stats";

const DAY_MS = 86_400_000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// How much workout history to hydrate for the /today lift-goal trends +
// last-workout card. Bounded and cheaper than the /workouts page's 200, but
// plenty for a strength-goal trend line.
const TODAY_WORKOUT_LIMIT = 60;

/** "Today" / "Yesterday" / "N days ago" / a short date, for the last-workout
 *  card. Day boundaries on the user's own wall clock (FEAT-8). */
function relativeDay(d: Date, timezone: string | null): string {
  const today = todayAnchorInTz(timezone);
  const that = calendarDayAnchorInTz(d, timezone);
  const diffDays = Math.round((today.getTime() - that.getTime()) / DAY_MS);
  if (diffDays <= 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return formatCalendarDay(d, { month: "short", day: "numeric" });
}

export default function TodayPage() {
  return (
    <PageShell active="/today" className="max-w-[1500px]">
      {/* Bottom-anchored receipts (P56-D toast decision): success/error tint
          via richColors, anchored in the thumb zone and offset above the
          phone tab bar; desktop keeps a comfortable bottom margin. */}
      <Toaster
        mobileOffset={{ bottom: 76 }}
        offset={{ bottom: 24 }}
        position="bottom-center"
        richColors
        theme="system"
      />
      <Suspense fallback={<TodaySkeleton />}>
        <TodayContent />
      </Suspense>
    </PageShell>
  );
}

async function TodayContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  // Legal gate (BLK-4): accept the Terms before using the product.
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }
  // First-run onboarding (ONB-1): a new member with access hasn't set up yet;
  // route them through the welcome wizard once before the dashboard.
  if (!user.onboardedAt) {
    redirect("/welcome");
  }

  const isPro = canAccessProFeatures(user);
  const plan = toPlanStatusSummary(user);

  // "Today" on the member's own wall clock (FEAT-8): the query bound is their
  // real local midnight as a UTC instant, and the anchor is that calendar day
  // for streak/week-strip math (see lib/date.ts).
  const timezone = user.timezone;
  const startOfToday = todayStartInTz(timezone);

  // Window for the streak / week strip. Long enough that a real streak isn't
  // capped, cheap because each select pulls a single timestamp column.
  const activitySince = new Date(startOfToday.getTime() - 120 * DAY_MS);
  // Meals for the whole current week (consistency matrix + today's macros);
  // 7 local days back always covers the Sunday-start week.
  const mealsSince = new Date(startOfToday.getTime() - 7 * DAY_MS);

  const [
    memory,
    entries,
    weekMeals,
    target,
    waterMl,
    waterDaily,
    goals,
    pastGoals,
    plans,
    pastPlans,
    recentWorkouts,
    activityDays,
    mealPlan,
    latestSleep,
    sleepDaily,
  ] = await Promise.all([
    getUserMemory(user.id),
    isPro ? getProgressEntriesByUserId(user.id) : Promise.resolve([]),
    isPro ? getMealsSince(user.id, mealsSince) : Promise.resolve([]),
    isPro ? getNutritionTarget(user.id) : Promise.resolve(undefined),
    isPro ? getWaterMlSince(user.id, startOfToday) : Promise.resolve(0),
    isPro ? getWaterDailyTotals(user.id, timezone) : Promise.resolve([]),
    getActiveGoalsByUserId(user.id),
    getInactiveGoalsByUserId(user.id),
    getActivePlansByUserId(user.id),
    getInactivePlansByUserId(user.id),
    canAccessProFeatures(user)
      ? getWorkoutsByUserId(user.id, TODAY_WORKOUT_LIMIT)
      : Promise.resolve([]),
    isPro
      ? getActivityDaysSince(user.id, activitySince)
      : Promise.resolve<Date[]>([]),
    isPro ? getActiveMealPlanByUserId(user.id) : Promise.resolve(null),
    isPro ? getLatestSleepEntry(user.id) : Promise.resolve(null),
    isPro ? getSleepDailyTotals(user.id, timezone) : Promise.resolve([]),
  ]);

  // Today's meals from the week fetch: effective day = recordedAt ?? createdAt
  // (the getMealsSince convention), bounded by the member-local today window.
  const todaysMeals = weekMeals.filter(
    (m) => (m.recordedAt ?? m.createdAt) >= startOfToday
  );

  // Active meal plan summary for the plan card. Targets stay structured so
  // the card renders them as labeled chips (VF-16). LC-2: the live daily
  // Calorie-Tracker target wins; the plan snapshot is the fallback.
  const planTargets =
    target?.calories != null
      ? {
          calories: target.calories,
          protein: target.protein ?? 0,
          carbs: target.carbs ?? 0,
          fat: target.fat ?? 0,
        }
      : mealPlan?.targetCalories != null
        ? {
            calories: mealPlan.targetCalories,
            protein: mealPlan.targetProtein ?? 0,
            carbs: mealPlan.targetCarbs ?? 0,
            fat: mealPlan.targetFat ?? 0,
          }
        : null;
  const mealPlanSummary = mealPlan
    ? {
        title: mealPlan.title,
        dayCount: Array.isArray(mealPlan.days) ? mealPlan.days.length : 0,
        targets: planTargets
          ? ([
              {
                value: planTargets.calories.toLocaleString(),
                label: "cal / day",
              },
              { value: `${planTargets.protein}g`, label: "protein" },
              { value: `${planTargets.carbs}g`, label: "carbs" },
              { value: `${planTargets.fat}g`, label: "fat" },
            ] as const)
          : null,
      }
    : null;

  // Most-recent logged workout, summarized for the workout card. Volume is
  // the card's visual anchor (VF-16).
  const lastWorkout = recentWorkouts[0]
    ? {
        title: recentWorkouts[0].title,
        performedAt: recentWorkouts[0].performedAt,
        exerciseCount: recentWorkouts[0].exercises.length,
        setCount: recentWorkouts[0].exercises.reduce(
          (sum, ex) => sum + ex.sets.length,
          0
        ),
        volumeLb: Math.round(workoutVolumeLb(toWorkoutData(recentWorkouts[0]))),
      }
    : null;

  // Strip the DB rows down to the serializable shape the client cards need.
  const toGoalItem = (g: (typeof goals)[number]) => ({
    id: g.id,
    title: g.title,
    detail: g.detail,
    targetDate: g.targetDate,
    status: g.status,
    metric: g.metric,
    metricRef: g.metricRef,
    startValue: g.startValue,
    currentValue: g.currentValue,
    targetValue: g.targetValue,
    unit: g.unit,
    // Anchors relative deadlines like "8 weeks" on the card (LC-5).
    createdAtLabel: formatDayInTzSmartYear(g.createdAt, timezone),
  });
  const goalItems = goals.map(toGoalItem);
  const pastGoalItems = pastGoals.map(toGoalItem);

  // Coherence nudges (P2-4), shared with /goals via lib/goals/coherence.
  const calorieConflict = findCalorieConflict(goalItems, target?.calories);
  const overlapIds = findOverlapIds(goalItems);

  // Lift goals (DSH-28): est.-1RM trend per tracked exercise from the logged
  // workouts, so the goal card shows live progress against real PR data.
  const workoutData = recentWorkouts.map(toWorkoutData);

  const liftProgress: Record<string, LiftProgress> = {};
  for (const g of goalItems) {
    if (g.metric === "lift" && g.metricRef) {
      const points = exercise1RMTrend(workoutData, g.metricRef);
      liftProgress[g.id] = {
        current: points.at(-1)?.value ?? null,
        first: points[0]?.value ?? null,
        points,
      };
    }
  }
  const toPlanItem = (p: (typeof plans)[number]) => ({
    id: p.id,
    title: p.title,
    detail: p.detail,
    kind: p.kind,
    status: p.status,
  });
  const planItems = plans.map(toPlanItem);
  const pastPlanItems = pastPlans.map(toPlanItem);

  const profile = memory?.profile ?? null;
  const nameField = clientField(profile, "Name");
  const firstName = nameField ? nameField.split(/\s+/)[0] : null;
  const workoutPlan = clientField(profile, "Current workout plan");

  // Weight summary (Pro).
  const weighed = entries.filter(
    (e): e is ProgressEntry & { weight: number } => e.weight != null
  );
  // Account-level unit preference wins, else infer from the latest weigh-in.
  const displayUnit: "lb" | "kg" =
    user.weightUnit ??
    (weighed.length > 0 ? weighed[weighed.length - 1].unit : "lb");
  const points = weighed.map((e) => ({
    t: e.recordedAt.getTime(),
    weight: round1(
      e.unit === displayUnit
        ? e.weight
        : displayUnit === "lb"
          ? e.weight * LB_PER_KG
          : e.weight / LB_PER_KG
    ),
  }));
  // The canonical "current weight" is the smoothed TREND weight (LC-4), the
  // same gap-aware EMA the charts draw, never the latest raw weigh-in.
  const trendRows = ema(points);
  const trendWeight = trendRows.at(-1)?.trend ?? null;
  const lastWeighIn = points.at(-1)?.weight ?? null;
  const startWeight = trendRows.at(0)?.trend ?? null;
  const weightChange =
    trendWeight != null && startWeight != null
      ? round1(trendWeight - startWeight)
      : null;

  // The target from an active weight goal, converted into the displayed unit,
  // so the chart can draw the goal-weight line.
  const weightGoal = goalItems.find(
    (g) => g.metric === "weight" && g.targetValue != null
  );
  const goalWeight =
    weightGoal?.targetValue == null
      ? null
      : round1(
          (weightGoal.unit ?? "").trim().toLowerCase().startsWith("k")
            ? displayUnit === "kg"
              ? weightGoal.targetValue
              : weightGoal.targetValue * LB_PER_KG
            : displayUnit === "lb"
              ? weightGoal.targetValue
              : weightGoal.targetValue / LB_PER_KG
        );

  // Daily hydration goal (DSH-24): user-set in ml, else one gallon.
  const waterGoalMl = user.waterGoalMl ?? DEFAULT_WATER_GOAL_ML;

  // Registered source for nutrition.*.today (lib/contracts/metrics.ts): the
  // one sumMacros in lib/ai/dashboard.ts, never per-card inline reduces.
  const {
    calories: caloriesToday,
    protein: proteinToday,
    carbs: carbsToday,
    fat: fatToday,
  } = sumMacros(todaysMeals);

  // Streak + this week's strip from every tracked action (meals, workouts,
  // water, weigh-ins), so engagement on any surface keeps the streak alive.
  // Sunday-start member-local week (VF-10); 00:00-UTC anchors.
  const streak = computeStreak(activityDays, timezone);
  const activeDayKeys = new Set(
    activityDays.map((d) =>
      toCalendarDayISO(calendarDayAnchorInTz(d, timezone))
    )
  );
  const { days: weekDays, todayMs } = weekAnchors(timezone);
  const week = weekDays.map((d) => ({
    label: weekSlotLabel(d),
    dateLabel: weekSlotDateLabel(d),
    active: activeDayKeys.has(toCalendarDayISO(d)),
    isToday: d.getTime() === todayMs,
    isFuture: d.getTime() > todayMs,
  }));

  // Domain week strips: the registered week builders (lib/today/week.ts).
  const lastNight = buildLastNight(latestSleep, timezone);
  const sleepWeek = buildSleepWeek(sleepDaily, timezone);
  const waterWeek = buildWaterWeek(waterDaily, timezone);
  const workoutWeek = buildWorkoutWeek(
    recentWorkouts.map((w) => w.performedAt),
    timezone
  );
  // Meal days through the same Sunday-start bucketer (consistency matrix).
  const mealWeek = buildWorkoutWeek(
    weekMeals.map((m) => m.recordedAt ?? m.createdAt),
    timezone
  );

  // The FIX-24 domain-aware matrix rows, aligned to the week's 7 columns.
  const consistencyDomains: ConsistencyDomainRow[] = [
    {
      id: "nutrition",
      label: "Nutrition",
      days: mealWeek.map((d) => d.logged),
    },
    {
      id: "hydration",
      label: "Hydration",
      days: waterWeek.map((d) => d.logged),
    },
    { id: "sleep", label: "Sleep", days: sleepWeek.map((d) => d.logged) },
    {
      id: "training",
      label: "Training",
      days: workoutWeek.map((d) => d.logged),
    },
  ];

  // FIX-23: the active training plan's resolved schedule + completions feed
  // the deterministic Up next selector (P34-D's rotation model; FIX-28).
  const trainingPlan = plans.find((p) => p.kind === "training") ?? null;
  let upNextTraining: UpNextSnapshot["training"] = null;
  let plannedPerWeek: number | null = null;
  if (isPro && trainingPlan) {
    const scheduleView = await resolvePlanScheduleView(trainingPlan);
    if (scheduleView.kind !== "document") {
      const completionRows = await getPlanSessionCompletions({
        planId: trainingPlan.id,
        userId: user.id,
      });
      const completions: CompletionEvent[] = completionRows.map((c) => ({
        planSessionId: c.planSessionId,
        completedDayMs: c.completedDay.getTime(),
      }));
      const weekStartMs = weekDays[0].getTime();
      const weekEndMs = weekStartMs + 7 * DAY_MS;
      const todayAnchorMs = todayAnchorInTz(timezone).getTime();
      const bySession = new Map<string, boolean>();
      for (const c of completions) {
        if (c.completedDayMs >= weekStartMs && c.completedDayMs < weekEndMs) {
          bySession.set(c.planSessionId, true);
        }
      }
      upNextTraining = {
        planId: trainingPlan.id,
        planTitle: trainingPlan.title,
        verdict: selectUpNextSession(scheduleView.schedule, completions),
        trainedToday: completions.some(
          (c) => c.completedDayMs === todayAnchorMs
        ),
        rotation: [...scheduleView.schedule.sessions]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            name: s.name,
            completedThisWeek:
              s.id !== null && (bySession.get(s.id) ?? false),
          })),
      };
      plannedPerWeek = weeklyPlanAdherence({
        schedule: scheduleView.schedule,
        completions,
        weekStartMs,
        weekEndMs,
      }).plannedPerWeek;
    }
  }

  const upNext = selectUpNextToday({
    training: upNextTraining,
    lastNightLogged: lastNight?.isCurrent === true,
    hasMealPlan: mealPlan != null,
    mealsLoggedToday: todaysMeals.length,
    isPro,
  });

  // Honest per-kind visuals for the Up next panel (real data only).
  const sleepGoalMinutes = user.sleepGoalMinutes ?? null;
  const sleepBars: DayBar[] = sleepWeek.map((d) => ({
    key: d.t,
    fraction: d.logged
      ? sleepGoalMinutes
        ? d.minutes / sleepGoalMinutes
        : 1
      : null,
    isToday: d.isToday,
    isFuture: d.isFuture,
  }));
  const sparkSource = trendRows.slice(-10);
  const sparkT0 = sparkSource[0]?.t ?? 0;
  const sparkSpan = (sparkSource.at(-1)?.t ?? 1) - sparkT0 || 1;
  const weightSpark: SparkPoint[] = sparkSource.map((r) => ({
    x: (r.t - sparkT0) / sparkSpan,
    value: r.trend,
  }));

  // First-run: a brand-new member with no profile and nothing logged yet.
  // The header carries the page's ONE dominant action (P1-4); the shell
  // panels (status, Up next, consistency) hold back until there is a day to
  // summarize, and every empty card below stays quiet.
  const isReturning =
    Boolean(profile) || entries.length > 0 || todaysMeals.length > 0;
  const firstRun = !isReturning;

  // "Sunday, July 13" on the member's own wall clock (R2-11).
  const todayLabel = formatDayInTz(new Date(), timezone, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const heroLine = isReturning
    ? firstName
      ? `Welcome back, ${firstName}`
      : "Welcome back"
    : "Welcome to Chad";

  return (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
      <div className="flex flex-col gap-8">
        {/* 1. Compact header (FIX-22 / DEC-05): date, greeting, tier, one
            quiet Coach action. The silhouette customizer lives at
            Account > Appearance now. */}
        <TodayHeader
          firstRun={firstRun}
          heroLine={heroLine}
          planBadge={<PlanBadge plan={plan} />}
          todayLabel={todayLabel}
        />

        {/* 2. Four-domain status strip (FIX-22): the day in ten seconds. */}
        {isPro && !firstRun && (
          <StatusStrip
            data={{
              nutrition: {
                calories: caloriesToday,
                target: target?.calories ?? null,
                mealsToday: todaysMeals.length,
                macros: {
                  protein: proteinToday,
                  carbs: carbsToday,
                  fat: fatToday,
                },
              },
              hydration: { ml: waterMl, goalMl: waterGoalMl },
              sleep: { lastNight, goalMinutes: sleepGoalMinutes },
              training: {
                week: workoutWeek.map((d) => ({
                  t: d.t,
                  logged: d.logged,
                  isToday: d.isToday,
                  isFuture: d.isFuture,
                })),
                sessionsThisWeek: workoutWeek.reduce((n, d) => n + d.count, 0),
                plannedPerWeek,
              },
            }}
          />
        )}

        {/* 3 + 4. Deterministic Up next (FIX-23) beside the seven-day
            consistency panel (FIX-24). */}
        {isPro && !firstRun && (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <UpNextPanel
              className="lg:col-span-2"
              verdict={upNext}
              visual={{
                sleepBars,
                mealChips: mealPlanSummary?.targets
                  ? [...mealPlanSummary.targets]
                  : undefined,
                weightSpark,
                weightSparkGoal:
                  goalWeight != null && weightSpark.length > 1
                    ? goalWeight
                    : undefined,
              }}
            />
            <ConsistencyPanel
              domains={consistencyDomains}
              streak={streak}
              week={week}
            />
          </div>
        )}

        {/* 5. Daily tracking (P56-C's panels mount here at integration; the
            calorie/sleep cards below are the live stand-ins until their
            FIX-25/27 panels publish). */}
        <SectionBand
          contentClassName="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
          description="Record these every day."
          title="Today's log"
        >
          {isPro ? (
            <ModuleCard className="lg:col-span-2" glow="amber">
              <ModuleHeader
                icon={<Utensils className="size-4" />}
                title="Calorie Tracker"
                tone="amber"
                viewHref="/nutrition#history"
              />
              <div className="mt-2 flex flex-1 flex-col justify-center">
                <MacroRings
                  caloriesConsumed={caloriesToday}
                  caloriesTarget={target?.calories ?? null}
                  carbsConsumed={carbsToday}
                  carbsTarget={target?.carbs ?? null}
                  emptyCta={
                    // First-run keeps this quiet (P1-4): the header owns the
                    // one CTA and Chad sets targets from the intro chat.
                    firstRun ? undefined : (
                      <TargetEditor
                        calories={target?.calories ?? null}
                        carbs={target?.carbs ?? null}
                        fat={target?.fat ?? null}
                        prominent
                        protein={target?.protein ?? null}
                      />
                    )
                  }
                  fatConsumed={fatToday}
                  fatTarget={target?.fat ?? null}
                  proteinConsumed={proteinToday}
                  proteinTarget={target?.protein ?? null}
                />
              </div>
              <ModuleFooter
                askChad={
                  <AskChadButton
                    className="min-h-11 sm:min-h-8"
                    prompt="Look at what I've eaten today and how it stacks up against my calorie and macro targets. Am I on track, and what should I eat for the rest of the day?"
                  />
                }
                status={
                  todaysMeals.length > 0
                    ? `${todaysMeals.length} meal${todaysMeals.length === 1 ? "" : "s"} logged today`
                    : "No meals logged yet today."
                }
              >
                <TargetEditor
                  calories={target?.calories ?? null}
                  carbs={target?.carbs ?? null}
                  fat={target?.fat ?? null}
                  protein={target?.protein ?? null}
                />
                <Button
                  asChild
                  className="min-h-11 gap-1.5 sm:min-h-8"
                  size="sm"
                  variant="outline"
                >
                  <Link href="/nutrition#log-meal">
                    Log a meal
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </ModuleFooter>
            </ModuleCard>
          ) : (
            <LockedCard
              className="lg:col-span-2"
              icon={<Utensils className="size-4" />}
              text="Snap a meal, fridge, or pantry and Chad grades the macros, then tracks your calories and protein against a daily target. Pro only."
              title="Calorie Tracker"
            />
          )}

          {isPro ? (
            /* P2-Z pilot: the first live panel on the Phase 2 system. */
            <HydrationPanel
              goalMl={waterGoalMl}
              totalMl={waterMl}
              viewHref="/hydration"
              week={waterWeek}
            />
          ) : (
            <LockedCard
              icon={<Droplet className="size-4" />}
              text="Track your daily water against a goal with one-tap logging. Pro only."
              title="Hydration"
            />
          )}

          {isPro ? (
            <SleepTracker
              goalMinutes={user.sleepGoalMinutes ?? undefined}
              last={lastNight}
              quiet={firstRun}
              viewHref="/sleep"
              week={sleepWeek}
            />
          ) : (
            <LockedCard
              icon={<Moon className="size-4" />}
              text="Log how you sleep each night and Chad factors recovery into your training. Pro only."
              title="Sleep"
            />
          )}
        </SectionBand>

        {/* 6. Plans and goals (P56-E rebuilds these summaries; the workout
            action card sits with the plans per the target architecture,
            since training is execution, not a passive daily logger). */}
        <SectionBand
          contentClassName="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
          description="Set once, update occasionally."
          title="Your plans"
        >
          <ModuleCard className="lg:col-span-2 xl:col-span-1" glow="blood">
            <GoalList
              calorieConflict={calorieConflict}
              currentWeight={trendWeight}
              goals={goalItems}
              liftProgress={liftProgress}
              memoryGoalHint={clientField(profile, "Primary goal")}
              overlapIds={overlapIds}
              pastGoals={pastGoalItems}
              quiet={firstRun}
              viewHref="/goals"
            />
          </ModuleCard>

          <ModuleCard glow="blood">
            <PlanList
              memoryPlanHint={workoutPlan}
              pastPlans={pastPlanItems}
              plans={planItems}
              quiet={firstRun}
            />
          </ModuleCard>

          {isPro ? (
            <ModuleCard glow="amber">
              <ModuleHeader
                icon={<ChefHat className="size-4" />}
                title="Meal Plan"
                tone="amber"
                viewHref={mealPlanSummary ? "/meal-plan" : undefined}
                viewLabel="View plan"
              />
              {mealPlanSummary ? (
                <div className="flex flex-1 flex-col justify-center gap-4">
                  <div className="flex items-center gap-4">
                    {/* Plain <img> (proxy serves it on this authed route) */}
                    <img
                      alt=""
                      aria-hidden
                      className="size-20 shrink-0 select-none rounded-xl object-cover ring-1 ring-border"
                      src="/today/food-salmon-bowl.png"
                    />
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-lg leading-tight">
                        {mealPlanSummary.title}
                      </div>
                      <div className="mt-0.5 text-muted-foreground text-sm">
                        {mealPlanSummary.dayCount}-day plan
                      </div>
                    </div>
                  </div>
                  {mealPlanSummary.targets && (
                    <div className="flex flex-wrap gap-2">
                      {mealPlanSummary.targets.map((t) => (
                        <div
                          className="flex items-baseline gap-1.5 rounded-xl border border-border bg-background/40 px-3 py-1.5"
                          key={t.label}
                        >
                          <span className="font-display font-semibold text-sm leading-none">
                            {t.value}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {t.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No meal plan yet. Have Chad build a structured plan around
                  your macro target. Real foods, exact portions.
                </p>
              )}
              <ModuleFooter
                askChad={
                  <AskChadButton
                    className="min-h-11 sm:min-h-8"
                    prompt={
                      mealPlanSummary
                        ? "Walk me through my meal plan. What am I eating today, and what can I swap if I'm missing something?"
                        : "Should I be on a structured meal plan for my goal? What would you put in one for me?"
                    }
                  />
                }
              >
                <Button
                  asChild
                  className="min-h-11 gap-1.5 sm:min-h-8"
                  size="sm"
                  variant="outline"
                >
                  <Link href="/meal-plan">
                    {mealPlanSummary ? "Open plan" : "Build a meal plan"}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </ModuleFooter>
            </ModuleCard>
          ) : (
            <LockedCard
              icon={<ChefHat className="size-4" />}
              text="Chad builds a structured meal plan around your macro target. Real foods, exact portions. Pro only."
              title="Meal Plan"
            />
          )}

          {/* Workout log: execution entry point + last-session context,
              beside the training plan (03 spec section 3). */}
          {isPro ? (
            <ModuleCard className="lg:col-span-2 xl:col-span-3" glow="blood">
              <ModuleHeader
                icon={<Dumbbell className="size-4" />}
                title="Workout log"
                tone="blood"
                viewHref="/workouts#history"
              />
              <div className="flex flex-1 flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                  {lastWorkout ? (
                    <div className="min-w-0">
                      <div className="text-muted-foreground text-xs uppercase tracking-wide">
                        Last session
                      </div>
                      <div className="mt-1 font-display font-semibold text-lg leading-tight">
                        {lastWorkout.title}
                      </div>
                      <div className="mt-0.5 text-muted-foreground text-sm">
                        {relativeDay(lastWorkout.performedAt, timezone)}
                      </div>
                    </div>
                  ) : (
                    <p className="max-w-md text-muted-foreground text-sm">
                      No workouts logged yet. Log your first session and Chad
                      starts tracking your PRs and volume.
                    </p>
                  )}
                  {/* Shared Sunday-start week-strip treatment (VF-10/VF-11),
                      workout tone. Always rendered (VF-16). */}
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-background/40 px-4 py-2.5">
                    <span className="text-muted-foreground text-xs">
                      This week
                    </span>
                    <WeekStrip
                      days={workoutWeek.map((day) => ({
                        key: day.t,
                        label: day.label,
                        dateLabel: day.dateLabel,
                        isToday: day.isToday,
                        isFuture: day.isFuture,
                        dotClassName: day.logged
                          ? "bg-blood shadow-[var(--shadow-glow-blood)]"
                          : "bg-border",
                        value: day.logged
                          ? `${day.count} workout${day.count === 1 ? "" : "s"}`
                          : "No workout",
                      }))}
                    />
                  </div>
                </div>
                {lastWorkout && (
                  <div className="flex flex-wrap gap-3">
                    <WorkoutStat
                      label={lastWorkout.setCount === 1 ? "set" : "sets"}
                      value={String(lastWorkout.setCount)}
                    />
                    <WorkoutStat
                      label={
                        lastWorkout.exerciseCount === 1
                          ? "exercise"
                          : "exercises"
                      }
                      value={String(lastWorkout.exerciseCount)}
                    />
                    {lastWorkout.volumeLb > 0 && (
                      <WorkoutStat
                        label="lb moved"
                        value={lastWorkout.volumeLb.toLocaleString()}
                      />
                    )}
                  </div>
                )}
              </div>
              <ModuleFooter
                askChad={
                  <AskChadButton
                    className="min-h-11 sm:min-h-8"
                    prompt="Look at the workouts card on my dashboard: my last session and this week's training. What's working, what's lagging, and what should I hit next session?"
                  />
                }
              >
                <Button
                  asChild
                  className="min-h-11 gap-1.5 sm:min-h-8"
                  size="sm"
                  variant="outline"
                >
                  <Link href="/workouts">
                    Start a workout
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </ModuleFooter>
            </ModuleCard>
          ) : (
            <LockedCard
              className="lg:col-span-2 xl:col-span-3"
              icon={<Dumbbell className="size-4" />}
              text="Log your workouts and Chad tracks your PRs, volume, and what to hit next session. Pro only."
              title="Workout log"
            />
          )}
        </SectionBand>

        {/* 7. Progress highlights (P56-E wires the /progress category links
            after GATE-05; the weight trend is the live highlight until then).
            8. The weekly-review + Coach-insight slots land in P7 (FIX-36A/B)
            per the contracts; deliberately not built here. */}
        <SectionBand
          description="What your daily logging adds up to over time."
          title="Results"
        >
          {isPro ? (
            <ModuleCard glow="violet">
              <ModuleHeader
                icon={<LineChart className="size-4" />}
                title="Weight trend"
                tone="violet"
                viewHref="/progress/body"
                viewLabel="Body progress"
              />
              {trendWeight != null && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-display font-semibold text-lg leading-none">
                    {trendWeight} {displayUnit}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    trend weight
                    {lastWeighIn != null && lastWeighIn !== trendWeight
                      ? ` · weighed in ${lastWeighIn} ${displayUnit}`
                      : ""}
                    {weightChange != null &&
                      ` · ${weightChange > 0 ? "+" : ""}${weightChange} ${displayUnit} since your first weigh-in`}
                  </span>
                </div>
              )}
              <div className="mt-2">
                {points.length > 0 ? (
                  <WeightChartInteractive
                    goalWeight={goalWeight}
                    points={points}
                    unit={displayUnit}
                    variant="compact"
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No weigh-ins yet. Log your weight to see the trend.
                  </p>
                )}
              </div>
              <ModuleFooter
                askChad={
                  <AskChadButton
                    className="min-h-11 sm:min-h-8"
                    prompt="Look at the weight card on my dashboard: my latest weigh-in and the recent trend toward my goal weight. Am I moving in the right direction, and should I change anything?"
                  />
                }
              >
                <Button
                  asChild
                  className="min-h-11 gap-1.5 sm:min-h-8"
                  size="sm"
                  variant="outline"
                >
                  <Link href="/progress/body#log-entry">
                    Log weight
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </ModuleFooter>
            </ModuleCard>
          ) : (
            <LockedCard
              icon={<LineChart className="size-4" />}
              text="Track your weight and progress photos over time. Pro only."
              title="Weight trend"
            />
          )}
        </SectionBand>

        {/* The Quit Test's Today promotion is REMOVED per DEC-03 (the P6
            rebuild half of the decision); its owned destination is
            /quit-date in the utility nav group. */}
      </div>
    </RewardProvider>
  );
}

/** Compact stat tile for the Workout log card (VF-16). */
function WorkoutStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-xl border border-border bg-background/40 px-3.5 py-2">
      <span className="font-display font-semibold text-base leading-none">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function LockedCard({
  icon,
  title,
  text,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  /** Grid placement (LAY-1): the locked teaser sits in the same dashboard
   *  cell as the module it stands in for. */
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-border border-dashed bg-card p-6",
        className
      )}
    >
      <h2 className="mb-3 flex items-center gap-2.5 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
        {title}
      </h2>
      <div className="flex flex-1 flex-col items-start justify-center gap-3 py-4">
        <Lock className="size-5 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{text}</p>
        <Button asChild className="min-h-11 sm:min-h-8" size="sm">
          <Link href="/account">Upgrade to Pro</Link>
        </Button>
      </div>
    </section>
  );
}
