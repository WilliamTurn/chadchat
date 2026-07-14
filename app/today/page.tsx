import { ArrowRight, LineChart, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { RewardProvider } from "@/components/dashboard/reward";
import { PageShell } from "@/components/nav/page-shell";
import { WeightChartInteractive } from "@/components/progress/weight-chart-interactive";
import type { DayBar, SparkPoint } from "@/components/panels/visuals";
import {
  ConsistencyPanel,
  type ConsistencyDomainRow,
} from "@/components/today/consistency-panel";
import { GoalPrimary } from "@/components/today/goal-primary";
import { HydrationPanel } from "@/components/today/hydration-panel";
import { NutritionPanel } from "@/components/today/nutrition-panel";
import { PlanMealToday } from "@/components/today/plan-meal-today";
import { PlanTrainingToday } from "@/components/today/plan-training-today";
import {
  NutritionHighlight,
  RecoveryHighlight,
  TrainingHighlight,
} from "@/components/today/progress-highlights";
import {
  ModuleCard,
  ModuleFooter,
  ModuleHeader,
} from "@/components/today/module-card";
import { SectionBand } from "@/components/today/section-band";
import { SleepPanel } from "@/components/today/sleep-panel";
import { StatusStrip } from "@/components/today/status-strip";
import { PlanBadge, TodayHeader } from "@/components/today/today-header";
import { UpNextPanel } from "@/components/today/up-next-panel";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { ema } from "@/lib/chart/trend";
import { LB_PER_KG } from "@/lib/contracts/units";
import {
  calendarDayAnchorInTz,
  formatDayInTz,
  toCalendarDayISO,
  todayAnchorInTz,
  todayStartInTz,
} from "@/lib/date";
import {
  getActiveGoalsByUserId,
  getActiveMealPlanByUserId,
  getActivePlansByUserId,
  getActivityDaysSince,
  getProgressEntriesByUserId,
  getUserById,
  getUserMemory,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import type { ProgressEntry } from "@/lib/db/schema";
import { clientField } from "@/lib/memory/client-field";
import { toPlanStatusSummary } from "@/lib/subscription";
import {
  hydrationWeekAtGoal,
  nutritionWeekAdherence,
  sleepWeekAtGoal,
} from "@/lib/today/highlights";
import {
  getHydrationPanelData,
  getNutritionPanelData,
  getSleepPanelData,
} from "@/lib/today/panel-data";
import {
  getMealSliceForToday,
  getPrimaryGoalData,
  getTrainingTodayData,
} from "@/lib/today/plans-goals-data";
import { computeStreak } from "@/lib/today/streak";
import { selectUpNextToday, type UpNextSnapshot } from "@/lib/today/up-next";
import {
  buildWorkoutWeek,
  weekAnchors,
  weekSlotDateLabel,
  weekSlotLabel,
} from "@/lib/today/week";
import { cn } from "@/lib/utils";
import { toWorkoutData } from "@/lib/workouts/serialize";
import { volumeSinceLb } from "@/lib/workouts/training-analytics";

const DAY_MS = 86_400_000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// How much workout history to hydrate for /today (goal e1rm trends + the
// week's training numbers). Bounded and cheaper than the /workouts page's
// 200, but plenty for a strength-goal trend line.
const TODAY_WORKOUT_LIMIT = 60;

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

  const [memory, entries, goals, plans, recentWorkouts, activityDays, mealPlan] =
    await Promise.all([
      getUserMemory(user.id),
      isPro ? getProgressEntriesByUserId(user.id) : Promise.resolve([]),
      getActiveGoalsByUserId(user.id),
      getActivePlansByUserId(user.id),
      isPro
        ? getWorkoutsByUserId(user.id, TODAY_WORKOUT_LIMIT)
        : Promise.resolve([]),
      isPro
        ? getActivityDaysSince(user.id, activitySince)
        : Promise.resolve<Date[]>([]),
      isPro ? getActiveMealPlanByUserId(user.id) : Promise.resolve(null),
    ]);

  const profile = memory?.profile ?? null;
  const nameField = clientField(profile, "Name");
  const firstName = nameField ? nameField.split(/\s+/)[0] : null;

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
  const weightGoal = goals.find(
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
  const weekStartMs = weekDays[0].getTime();
  const weekEndMs = weekStartMs + 7 * DAY_MS;
  const todayAnchorMs = todayAnchorInTz(timezone).getTime();

  // ONE concurrent round for everything independent: the canonical tracking
  // assemblers (P56-C, lib/today/panel-data.ts; every daily-status number on
  // this page reads these, resolved against FIX-07 effective-dated per-day
  // targets), the training-plan resolution, and the primary-goal outcomes
  // (P56-E, lib/today/plans-goals-data.ts). The page never re-derives them.
  const trainingPlan = plans.find((p) => p.kind === "training") ?? null;
  const [[nutritionData, hydrationData, sleepData], trainingToday, primaryGoal] =
    await Promise.all([
      isPro
        ? Promise.all([
            getNutritionPanelData(user),
            getHydrationPanelData(user),
            getSleepPanelData(user),
          ])
        : Promise.resolve([null, null, null] as const),
      trainingPlan
        ? getTrainingTodayData({
            user,
            plan: trainingPlan,
            weekStartMs,
            weekEndMs,
            todayAnchorMs,
          })
        : Promise.resolve(null),
      getPrimaryGoalData({
        user,
        goals,
        trendWeight,
        trendUnit: displayUnit,
        workouts: recentWorkouts.map(toWorkoutData),
      }),
    ]);

  const mealsToday = nutritionData?.mealsToday ?? 0;
  const lastNight = sleepData?.lastNight ?? null;
  const sleepGoalMinutes = sleepData?.goalMinutes ?? null;

  // Domain weeks: tracking domains come from the assemblers above; training
  // buckets through the registered week builder (lib/today/week.ts).
  const workoutWeek = buildWorkoutWeek(
    recentWorkouts.map((w) => w.performedAt),
    timezone
  );

  // The FIX-24 domain-aware matrix rows, aligned to the week's 7 columns.
  const consistencyDomains: ConsistencyDomainRow[] = [
    {
      id: "nutrition",
      label: "Nutrition",
      days: (nutritionData?.week ?? []).map((d) => d.logged),
    },
    {
      id: "hydration",
      label: "Hydration",
      days: (hydrationData?.week ?? []).map((d) => d.logged),
    },
    {
      id: "sleep",
      label: "Sleep",
      days: (sleepData?.week ?? []).map((d) => d.logged),
    },
    {
      id: "training",
      label: "Training",
      days: workoutWeek.map((d) => d.logged),
    },
  ];

  // FIX-30: training resolved ONCE above; the Training-today card, Up next,
  // the status strip, and the training highlight all read that one
  // resolution. The meal slice is pure math over the plan document.
  const plannedPerWeek = trainingToday?.adherence?.plannedPerWeek ?? null;

  const mealSlice =
    isPro && mealPlan && nutritionData
      ? getMealSliceForToday({
          user,
          mealPlan,
          mealsLoggedToday: nutritionData.mealsToday,
        })
      : null;

  // FIX-23: Up next consumes the same training resolution (Pro only, as
  // before: below Pro the training CTA would land on a locked logger).
  const upNextTraining: UpNextSnapshot["training"] =
    isPro && trainingToday && trainingToday.kind !== "document"
      ? {
          planId: trainingToday.planId,
          planTitle: trainingToday.planTitle,
          verdict: trainingToday.verdict,
          trainedToday: trainingToday.trainedToday,
          rotation: trainingToday.rotation,
        }
      : null;

  const upNext = selectUpNextToday({
    training: upNextTraining,
    lastNightLogged: lastNight?.isCurrent === true,
    hasMealPlan: mealPlan != null,
    mealsLoggedToday: mealsToday,
    isPro,
  });

  // Honest per-kind visuals for the Up next panel (real data only). Sleep
  // bars grade each night against ITS OWN effective-dated goal (FIX-07).
  const sleepBars: DayBar[] = (sleepData?.week ?? []).map((d) => ({
    key: d.t,
    fraction: d.logged
      ? d.goalMinutes > 0
        ? d.minutes / d.goalMinutes
        : 1
      : null,
    isToday: d.isToday,
    isFuture: d.isFuture,
  }));
  // The meal plan's daily targets for the Up next chips (LC-2: the live
  // daily target wins; the plan snapshot is the fallback).
  const chipTargets =
    nutritionData?.target?.calories != null
      ? {
          calories: nutritionData.target.calories,
          protein: nutritionData.target.protein ?? 0,
          carbs: nutritionData.target.carbs ?? 0,
          fat: nutritionData.target.fat ?? 0,
        }
      : mealPlan?.targetCalories != null
        ? {
            calories: mealPlan.targetCalories,
            protein: mealPlan.targetProtein ?? 0,
            carbs: mealPlan.targetCarbs ?? 0,
            fat: mealPlan.targetFat ?? 0,
          }
        : null;
  const mealChips = chipTargets
    ? [
        {
          value: chipTargets.calories.toLocaleString(),
          label: "cal / day",
        },
        { value: `${chipTargets.protein}g`, label: "protein" },
        { value: `${chipTargets.carbs}g`, label: "carbs" },
        { value: `${chipTargets.fat}g`, label: "fat" },
      ]
    : undefined;
  const sparkSource = trendRows.slice(-10);
  const sparkT0 = sparkSource[0]?.t ?? 0;
  const sparkSpan = (sparkSource.at(-1)?.t ?? 1) - sparkT0 || 1;
  const weightSpark: SparkPoint[] = sparkSource.map((r) => ({
    x: (r.t - sparkT0) / sparkSpan,
    value: r.trend,
  }));

  // Progress highlights (P56-E): the week graded through the overview's own
  // registered source symbols (lib/today/highlights.ts), so these tiles and
  // /progress can never disagree. Volume sums weight x reps, so exercise
  // identity resolution cannot change it; the week's sessions sit inside the
  // 60-workout hydration by construction.
  const nutritionWeekSummary = nutritionData
    ? nutritionWeekAdherence(nutritionData.week)
    : null;
  const hydrationWeekSummary = hydrationData
    ? hydrationWeekAtGoal(hydrationData.week)
    : null;
  const sleepWeekSummary = sleepData ? sleepWeekAtGoal(sleepData.week) : null;
  const trainingHighlight = isPro
    ? {
        sessionsThisWeek: workoutWeek.reduce((n, d) => n + d.count, 0),
        volumeWeekLb: volumeSinceLb(
          recentWorkouts.map(toWorkoutData),
          weekStartMs,
          timezone
        ),
        week: workoutWeek.map((d) => ({
          t: d.t,
          logged: d.logged,
          isToday: d.isToday,
          isFuture: d.isFuture,
        })),
        completion: trainingToday?.adherence ?? null,
      }
    : null;

  // First-run: a brand-new member with no profile and nothing logged yet.
  // The header carries the page's ONE dominant action (P1-4); the shell
  // panels (status, Up next, consistency) hold back until there is a day to
  // summarize, and every empty card below stays quiet.
  const isReturning = Boolean(profile) || entries.length > 0 || mealsToday > 0;
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
        {isPro && !firstRun && nutritionData && hydrationData && (
          <StatusStrip
            data={{
              nutrition: {
                calories: nutritionData.calories,
                target: nutritionData.target?.calories ?? null,
                mealsToday: nutritionData.mealsToday,
                macros: {
                  protein: nutritionData.protein,
                  carbs: nutritionData.carbs,
                  fat: nutritionData.fat,
                },
              },
              hydration: {
                ml: hydrationData.totalMl,
                goalMl: hydrationData.goalMl,
              },
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
                mealChips,
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

        {/* 5. Daily tracking: P56-C's typed panels on their canonical
            assemblers (FIX-25/26/27 mounted at integration, per the
            published mount contracts). */}
        <SectionBand
          contentClassName="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
          description="Record these every day."
          title="Today's log"
        >
          <div className="lg:col-span-2">
            {isPro && nutritionData ? (
              <NutritionPanel {...nutritionData} />
            ) : (
              <NutritionPanel
                calories={0}
                carbs={0}
                fat={0}
                locked
                mealsToday={0}
                protein={0}
                target={null}
                week={[]}
              />
            )}
          </div>

          {isPro && hydrationData ? (
            <HydrationPanel {...hydrationData} />
          ) : (
            <HydrationPanel locked totalMl={0} week={[]} />
          )}

          {isPro && sleepData ? (
            <SleepPanel {...sleepData} />
          ) : (
            <SleepPanel
              goalMinutes={480}
              lastNight={null}
              locked
              week={[]}
            />
          )}
        </SectionBand>

        {/* 6. Plans and goals (FIX-30): actionable summaries that tell the
            member what to do and link to authoritative detail. Plan
            MANAGEMENT lives at /plans now (relocated, nothing removed);
            goals keep /goals. The 03-spec 6/3/3 composition on desktop. */}
        <SectionBand
          contentClassName="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12"
          description="What you're committed to, and the next step for each."
          title="Plans and goals"
        >
          <PlanTrainingToday
            canStartWorkout={isPro}
            className="lg:col-span-2 xl:col-span-6"
            data={trainingToday}
          />
          <PlanMealToday
            className="xl:col-span-3"
            locked={!isPro}
            planTitle={mealPlan?.title ?? null}
            slice={mealSlice}
          />
          <GoalPrimary className="xl:col-span-3" data={primaryGoal} />
        </SectionBand>

        {/* 7. Progress highlights (P56-E): a curated, rewarding week summary;
            every card opens its named Progress category (the P5 wave's real
            destinations). 8. The weekly-review + Coach-insight slots land in
            P7 (FIX-36A/B) per the contracts; deliberately not built here. */}
        <SectionBand
          contentClassName="grid grid-cols-1 items-start lg:grid-cols-2"
          description="What your daily logging adds up to. Every card opens its full progress view."
          title="Progress highlights"
        >
          {isPro ? (
            <ModuleWeightTrend
              displayUnit={displayUnit}
              goalWeight={goalWeight}
              lastWeighIn={lastWeighIn}
              points={points}
              trendWeight={trendWeight}
              weightChange={weightChange}
            />
          ) : (
            <LockedCard
              icon={<LineChart className="size-4" />}
              text="Track your weight and progress photos over time. Pro only."
              title="Weight trend"
            />
          )}

          <TrainingHighlight data={trainingHighlight} locked={!isPro} />
          <NutritionHighlight
            locked={!isPro}
            summary={nutritionWeekSummary}
          />
          <RecoveryHighlight
            hydration={hydrationWeekSummary}
            locked={!isPro}
            sleep={sleepWeekSummary}
          />
        </SectionBand>

        {/* The Quit Test's Today promotion is REMOVED per DEC-03 (the P6
            rebuild half of the decision); its owned destination is
            /quit-date in the utility nav group. */}
      </div>
    </RewardProvider>
  );
}

/** The Body-trend highlight: the interactive weight trend, linking into
 *  /progress/body (the P5 Body category). Markup unchanged from the P56-D
 *  composition; only its band moved under Progress highlights. */
function ModuleWeightTrend({
  trendWeight,
  lastWeighIn,
  weightChange,
  displayUnit,
  points,
  goalWeight,
}: {
  trendWeight: number | null;
  lastWeighIn: number | null;
  weightChange: number | null;
  displayUnit: "lb" | "kg";
  points: { t: number; weight: number }[];
  goalWeight: number | null;
}) {
  return (
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
