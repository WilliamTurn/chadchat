import {
  Camera,
  ChefHat,
  CreditCard,
  Droplet,
  Dumbbell,
  LineChart,
  Lock,
  MessageSquare,
  Moon,
  Refrigerator,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { MacroRings } from "@/components/nutrition/macro-rings";
import { WeightChartInteractive } from "@/components/progress/weight-chart-interactive";
import { GoalList } from "@/components/today/goal-list";
import { type ChipTone, IconChip } from "@/components/today/icon-chip";
import { PlanList } from "@/components/today/plan-list";
import { StatPills } from "@/components/today/stat-pills";
import {
  type LastNight,
  type SleepNight,
  SleepTracker,
} from "@/components/today/sleep-tracker";
import { SleepTrendChart } from "@/components/today/sleep-trend-chart";
import { StreakStrip } from "@/components/today/streak-strip";
import { TargetEditor } from "@/components/today/target-editor";
import { WaterTracker } from "@/components/today/water-tracker";
import { WaterTrendChart } from "@/components/today/water-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getActiveGoalsByUserId,
  getActiveMealPlanByUserId,
  getActivePlansByUserId,
  getActivityDaysSince,
  getInactiveGoalsByUserId,
  getMealsSince,
  getLatestSleepEntry,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getSleepDailyTotals,
  getUserById,
  getUserMemory,
  getWaterDailyTotals,
  getWaterMlSince,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import {
  formatCalendarDay,
  startOfDayUTC,
  startOfTodayUTC,
  toCalendarDayISO,
} from "@/lib/date";
import type { ProgressEntry } from "@/lib/db/schema";
import { toPlanStatusSummary } from "@/lib/subscription";
import {
  goalDiagram,
  normalizeSex,
  resolveHero,
} from "@/lib/today/goal-diagram";
import { HeroCustomizer } from "@/components/today/hero-customizer";

const LB_PER_KG = 2.204_62;
const DAY_MS = 86_400_000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Pull a value from the "## Client file" block of Chad's memory profile. */
function clientField(
  profile: string | null | undefined,
  label: string
): string | null {
  if (!profile) {
    return null;
  }
  const escaped = label.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const re = new RegExp(`^[-*]\\s*${escaped}\\s*:\\s*(.+)$`, "im");
  const match = profile.match(re);
  const value = match?.[1]?.trim();
  if (!value || /^unknown$/i.test(value)) {
    return null;
  }
  return value;
}

/** "Today" / "Yesterday" / "N days ago" / a short date, for the last-workout card. */
function relativeDay(d: Date): string {
  const today = startOfTodayUTC();
  const that = startOfDayUTC(d);
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

/** Consecutive days (ending today or yesterday) with at least one logged action. */
function computeStreak(dates: Date[]): number {
  if (dates.length === 0) {
    return 0;
  }
  const days = new Set(dates.map(toCalendarDayISO));
  let cursor = startOfTodayUTC();
  if (!days.has(toCalendarDayISO(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!days.has(toCalendarDayISO(cursor))) {
      return 0;
    }
  }
  let streak = 0;
  while (days.has(toCalendarDayISO(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export default function TodayPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-10">
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />
      <StandaloneHeader active="/today" />
      <Suspense
        fallback={
          <div className="h-[600px] animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
        <TodayContent />
      </Suspense>
    </main>
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
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  const isPro = canAccessProFeatures(user);
  const plan = toPlanStatusSummary(user);

  const startOfToday = startOfTodayUTC();

  // Window for the streak / week strip — long enough that a real streak isn't
  // capped, cheap because each select pulls a single timestamp column.
  const activitySince = new Date(startOfToday.getTime() - 120 * DAY_MS);

  const [
    memory,
    entries,
    todaysMeals,
    target,
    waterMl,
    waterDaily,
    goals,
    pastGoals,
    plans,
    recentWorkouts,
    activityDays,
    mealPlan,
    latestSleep,
    sleepDaily,
  ] = await Promise.all([
    getUserMemory(user.id),
    isPro ? getProgressEntriesByUserId(user.id) : Promise.resolve([]),
    isPro ? getMealsSince(user.id, startOfToday) : Promise.resolve([]),
    isPro ? getNutritionTarget(user.id) : Promise.resolve(undefined),
    isPro ? getWaterMlSince(user.id, startOfToday) : Promise.resolve(0),
    isPro ? getWaterDailyTotals(user.id) : Promise.resolve([]),
    getActiveGoalsByUserId(user.id),
    getInactiveGoalsByUserId(user.id),
    getActivePlansByUserId(user.id),
    canAccessProFeatures(user)
      ? getWorkoutsByUserId(user.id, 1)
      : Promise.resolve([]),
    isPro
      ? getActivityDaysSince(user.id, activitySince)
      : Promise.resolve<Date[]>([]),
    isPro ? getActiveMealPlanByUserId(user.id) : Promise.resolve(null),
    isPro ? getLatestSleepEntry(user.id) : Promise.resolve(null),
    isPro ? getSleepDailyTotals(user.id) : Promise.resolve([]),
  ]);

  // Active meal plan summary for the /today card.
  const mealPlanSummary = mealPlan
    ? {
        title: mealPlan.title,
        dayCount: Array.isArray(mealPlan.days) ? mealPlan.days.length : 0,
        targetLine:
          mealPlan.targetCalories != null
            ? `${mealPlan.targetCalories.toLocaleString()} cal · ${mealPlan.targetProtein ?? 0}P / ${mealPlan.targetCarbs ?? 0}C / ${mealPlan.targetFat ?? 0}F`
            : null,
      }
    : null;

  // Most-recent logged workout, summarized for the /today card.
  const lastWorkout = recentWorkouts[0]
    ? {
        title: recentWorkouts[0].title,
        performedAt: recentWorkouts[0].performedAt,
        exerciseCount: recentWorkouts[0].exercises.length,
        setCount: recentWorkouts[0].exercises.reduce(
          (sum, ex) => sum + ex.sets.length,
          0
        ),
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
    startValue: g.startValue,
    targetValue: g.targetValue,
    unit: g.unit,
  });
  const goalItems = goals.map(toGoalItem);
  const pastGoalItems = pastGoals.map(toGoalItem);
  const planItems = plans.map((p) => ({
    id: p.id,
    title: p.title,
    detail: p.detail,
    kind: p.kind,
    status: p.status,
  }));

  const profile = memory?.profile ?? null;
  const nameField = clientField(profile, "Name");
  const firstName = nameField ? nameField.split(/\s+/)[0] : null;
  const goal = clientField(profile, "Primary goal");
  const workoutPlan = clientField(profile, "Current workout plan");

  // Decorative header figure (DSH-21): explicit choice → else gender-derived
  // silhouette (sex from Chad's memory) → else the male default.
  const hero = resolveHero(
    user.heroFigure,
    user.heroImageUrl,
    normalizeSex(clientField(profile, "Sex"))
  );

  // Weight summary (Pro).
  const weighed = entries.filter(
    (e): e is ProgressEntry & { weight: number } => e.weight != null
  );
  const displayUnit: "lb" | "kg" =
    weighed.length > 0 ? weighed[weighed.length - 1].unit : "lb";
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
  const currentWeight = points.at(-1)?.weight ?? null;
  const startWeight = points.at(0)?.weight ?? null;
  const weightChange =
    currentWeight != null && startWeight != null
      ? round1(currentWeight - startWeight)
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

  // Today's intake (Pro).
  const caloriesToday = todaysMeals.reduce(
    (sum, m) => sum + (m.calories ?? 0),
    0
  );
  const proteinToday = todaysMeals.reduce(
    (sum, m) => sum + (m.protein ?? 0),
    0
  );
  const carbsToday = todaysMeals.reduce((sum, m) => sum + (m.carbs ?? 0), 0);
  const fatToday = todaysMeals.reduce((sum, m) => sum + (m.fat ?? 0), 0);

  // Streak + 7-day week strip from every tracked action (meals, workouts,
  // water, weigh-ins), so engagement on any surface keeps the streak alive.
  const streak = computeStreak(activityDays);
  const activeDayKeys = new Set(activityDays.map(toCalendarDayISO));
  const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfToday.getTime() - (6 - i) * DAY_MS);
    return {
      label: WEEKDAY_INITIALS[d.getUTCDay()],
      active: activeDayKeys.has(toCalendarDayISO(d)),
      isToday: i === 6,
    };
  });
  const activeThisWeek = week.filter((d) => d.active).length;

  // The body diagram for the user's primary active goal — a decorative anatomical
  // figure (Phase 2 asset) recolored per goal intent, rendered faintly in the
  // Goals card. goalDiagram is a pure client-safe helper, so it runs here too.
  const goalArt = goalItems[0] ? goalDiagram(goalItems[0]) : null;

  // Sleep & recovery (Pro): last night's entry + a 7-night week strip. The
  // daily totals are keyed to midnight-UTC ms, which equals each week day's
  // startOfDayUTC time, so the lookup lines up across timezones (see lib/date.ts).
  const sleepByDay = new Map(sleepDaily.map((s) => [s.t, s] as const));
  const lastNight: LastNight = latestSleep
    ? {
        minutes: latestSleep.minutes,
        quality: latestSleep.quality,
        whenLabel: relativeDay(latestSleep.recordedAt),
      }
    : null;
  const sleepWeek: SleepNight[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfToday.getTime() - (6 - i) * DAY_MS);
    const entry = sleepByDay.get(d.getTime());
    return {
      t: d.getTime(),
      label: WEEKDAY_INITIALS[d.getUTCDay()],
      minutes: entry?.minutes ?? 0,
      quality: entry?.quality ?? null,
      logged: entry != null,
      isToday: i === 6,
    };
  });

  // First-run: a brand-new member with no profile and nothing logged yet. We
  // show a "welcome / get started" header instead of "Welcome back" (which is
  // illogical the very first time they sign in).
  const isReturning =
    Boolean(profile) || entries.length > 0 || todaysMeals.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div
          aria-hidden
          className="-right-16 -top-16 pointer-events-none absolute size-56 rounded-full bg-blood/25 blur-3xl"
        />
        {/* Brand hero figure (DSH-21) — decorative, bleeds off the right edge
            and fades into the card. A built-in silhouette cutout bleeds up from
            the bottom; a user-uploaded photo covers the right strip. Plain <img>
            (not next/image) so the proxy serves it on this authenticated route;
            hidden on small screens. */}
        {hero.kind === "custom" ? (
          <img
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-3/5 select-none object-cover opacity-80 [mask-image:linear-gradient(to_left,black_35%,transparent)] lg:block"
            src={hero.src}
          />
        ) : (
          <img
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-0 bottom-0 hidden h-[112%] w-auto select-none object-contain object-bottom opacity-90 [mask-image:linear-gradient(to_left,black_55%,transparent)] lg:block"
            src={hero.src}
          />
        )}
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              {isReturning ? "Welcome back" : "Welcome to Chad"}
            </p>
            <h1 className="mt-1 font-display font-bold text-3xl tracking-tight sm:text-4xl">
              {firstName ?? (isReturning ? "Let's work" : "Let's get started")}
            </h1>
            <p className="mt-2 max-w-md text-muted-foreground text-sm">
              {isReturning
                ? "Here's where you stand today. No excuses — just the numbers."
                : "Set your goal below, then tell Chad about yourself in chat. He'll build the plan from there."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {plan.tier === "pro" ? (
              <Badge variant="secondary">Pro</Badge>
            ) : plan.status === "trialing" && plan.trialDaysLeft !== null ? (
              <Badge variant="secondary">
                {plan.trialDaysLeft <= 0
                  ? "Trial ends today"
                  : `${plan.trialDaysLeft} days left in trial`}
              </Badge>
            ) : (
              <Badge variant="secondary">Basic</Badge>
            )}
            <Button asChild className="gap-1.5" size="sm">
              <Link href="/">
                <MessageSquare className="size-3.5" />
                Talk to Chad
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI vital strip (Pro) — at-a-glance numbers the page already computes */}
        {isPro && (
          <div className="relative">
            <StatPills
              activeThisWeek={activeThisWeek}
              calorieTarget={target?.calories ?? null}
              calories={caloriesToday}
              weightChange={weightChange}
              weightUnit={displayUnit}
            />
          </div>
        )}

        {/* Streak strip */}
        <div className="relative">
          <StreakStrip streak={streak} week={week} />
        </div>

        {/* Personalize the header figure (lg+ only, where it's visible) */}
        <div className="absolute right-4 bottom-4 z-10">
          <HeroCustomizer hero={hero} />
        </div>
      </header>

      {/* Today's meal log (Pro) — the daily centerpiece, full width */}
      {isPro ? (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle icon={<Utensils className="size-4" />} tone="amber">
              Today's meal log
            </CardTitle>
            <TargetEditor
              calories={target?.calories ?? null}
              carbs={target?.carbs ?? null}
              fat={target?.fat ?? null}
              protein={target?.protein ?? null}
            />
          </div>
          <div className="mt-2">
            <MacroRings
              caloriesConsumed={caloriesToday}
              caloriesTarget={target?.calories ?? null}
              carbsConsumed={carbsToday}
              carbsTarget={target?.carbs ?? null}
              emptyCta={
                <TargetEditor
                  calories={target?.calories ?? null}
                  carbs={target?.carbs ?? null}
                  fat={target?.fat ?? null}
                  prominent
                  protein={target?.protein ?? null}
                />
              }
              fatConsumed={fatToday}
              fatTarget={target?.fat ?? null}
              proteinConsumed={proteinToday}
              proteinTarget={target?.protein ?? null}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href="/nutrition"
            >
              {todaysMeals.length > 0
                ? `${todaysMeals.length} meal${todaysMeals.length === 1 ? "" : "s"} logged today`
                : "No meals logged yet today."}
            </Link>
            <div className="flex items-center gap-2">
              <AskChadButton prompt="Look at what I've eaten today and how it stacks up against my calorie and macro targets. Am I on track, and what should I eat for the rest of the day?" />
              <Button asChild className="gap-1.5" size="sm" variant="outline">
                <Link href="/nutrition">
                  <Camera className="size-4" />
                  Log a meal
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <LockedCard
          icon={<Utensils className="size-4" />}
          text="Snap a meal, fridge, or pantry and Chad grades the macros, then tracks your calories and protein against a daily target. Pro only."
          title="Today's meal log"
        />
      )}

      {/* Goal + Training */}
      <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
        <section className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-6">
          {goalArt && (
            <img
              alt=""
              aria-hidden
              className="pointer-events-none absolute right-0 bottom-0 hidden h-[104%] w-auto select-none object-contain object-bottom opacity-60 [mask-image:linear-gradient(to_left,black_45%,transparent_92%)] sm:block"
              src={goalArt.src}
            />
          )}
          <div className="relative flex flex-1 flex-col">
            <GoalList
              currentWeight={currentWeight}
              goals={goalItems}
              memoryGoalHint={goal}
              pastGoals={pastGoalItems}
            />
          </div>
        </section>

        <Card>
          <PlanList memoryPlanHint={workoutPlan} plans={planItems} />
        </Card>
      </div>

      {/* Last workout + Meal plan (Pro) */}
      {isPro && (
        <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle icon={<Dumbbell className="size-4" />} tone="blood">
                Last workout
              </CardTitle>
              <Button asChild className="gap-1.5" size="sm" variant="outline">
                <Link href="/workouts">
                  <Dumbbell className="size-3.5" />
                  View all
                </Link>
              </Button>
            </div>
            {lastWorkout ? (
              <div className="flex flex-1 flex-col justify-center">
                <div className="font-display font-semibold text-lg leading-tight">
                  {lastWorkout.title}
                </div>
                <div className="mt-0.5 text-muted-foreground text-sm">
                  {relativeDay(lastWorkout.performedAt)} ·{" "}
                  {lastWorkout.exerciseCount} exercise
                  {lastWorkout.exerciseCount === 1 ? "" : "s"} ·{" "}
                  {lastWorkout.setCount} set
                  {lastWorkout.setCount === 1 ? "" : "s"}
                </div>
              </div>
            ) : (
              <EmptyHint
                cta="Log a workout"
                href="/workouts"
                text="No workouts logged yet. Log your first session and Chad starts tracking your PRs and volume."
              />
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle icon={<ChefHat className="size-4" />} tone="amber">
                Meal plan
              </CardTitle>
              {mealPlanSummary && (
                <Button asChild className="gap-1.5" size="sm" variant="outline">
                  <Link href="/meal-plan">
                    <ChefHat className="size-3.5" />
                    View plan
                  </Link>
                </Button>
              )}
            </div>
            {mealPlanSummary ? (
              <div className="flex flex-1 items-center gap-4">
                {/* Plain <img> (proxy serves it on this authed route) */}
                <img
                  alt=""
                  aria-hidden
                  className="size-16 shrink-0 select-none rounded-xl object-cover ring-1 ring-border"
                  src="/today/food-salmon-bowl.png"
                />
                <div className="min-w-0">
                  <div className="font-display font-semibold text-lg leading-tight">
                    {mealPlanSummary.title}
                  </div>
                  <div className="mt-0.5 text-muted-foreground text-sm">
                    {mealPlanSummary.dayCount}-day plan
                    {mealPlanSummary.targetLine
                      ? ` · ${mealPlanSummary.targetLine}`
                      : ""}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyHint
                cta="Build a meal plan"
                href="/meal-plan"
                text="No meal plan yet. Have Chad build a structured plan around your macro target — real foods, exact portions."
              />
            )}
          </Card>
        </div>
      )}

      {/* Hydration + Weight (Pro) */}
      <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
        {isPro ? (
          <WaterTracker totalMl={waterMl} />
        ) : (
          <LockedCard
            icon={<Droplet className="size-4" />}
            text="Track your daily water against a goal with one-tap logging. Pro only."
            title="Hydration"
          />
        )}

        {isPro ? (
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle icon={<LineChart className="size-4" />} tone="violet">
                Weight trend
              </CardTitle>
              {currentWeight != null && (
                <div className="text-right">
                  <div className="font-display font-semibold text-lg leading-none">
                    {currentWeight} {displayUnit}
                  </div>
                  {weightChange != null && (
                    <div className="text-muted-foreground text-xs">
                      {weightChange > 0 ? "+" : ""}
                      {weightChange} since start
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-2">
              {points.length > 0 ? (
                <WeightChartInteractive
                  goalWeight={goalWeight}
                  points={points}
                  unit={displayUnit}
                  variant="compact"
                />
              ) : (
                <EmptyHint
                  cta="Log your weight"
                  href="/progress"
                  text="No weigh-ins yet. Log your weight to see the trend."
                />
              )}
            </div>
            {points.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <AskChadButton prompt="Look at my weight trend and how it's tracking against my goal weight. Am I moving in the right direction, and should I change anything?" />
                <Button asChild className="gap-1.5" size="sm" variant="outline">
                  <Link href="/progress">
                    <LineChart className="size-3.5" />
                    Log weight
                  </Link>
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <LockedCard
            icon={<LineChart className="size-4" />}
            text="Track your weight and progress photos over time. Pro only."
            title="Weight trend"
          />
        )}
      </div>

      {/* Sleep & recovery (Pro) */}
      {isPro ? (
        <SleepTracker last={lastNight} week={sleepWeek} />
      ) : (
        <LockedCard
          icon={<Moon className="size-4" />}
          text="Log how you sleep each night and Chad factors recovery into your training. Pro only."
          title="Sleep & recovery"
        />
      )}

      {/* Hydration trend (Pro) — full-width, once there's history to show */}
      {isPro && waterDaily.length >= 2 && (
        <WaterTrendChart days={waterDaily} />
      )}

      {/* Sleep trend (Pro) — full-width, once there's history to show */}
      {isPro && sleepDaily.length >= 2 && (
        <SleepTrendChart days={sleepDaily} />
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <QuickAction
          href="/"
          icon={<MessageSquare className="size-4" />}
          label="Talk to Chad"
        />
        <QuickAction
          href="/workouts"
          icon={<Dumbbell className="size-4" />}
          label="Workouts"
        />
        <QuickAction
          href="/nutrition"
          icon={<Camera className="size-4" />}
          label="Nutrition"
        />
        <QuickAction
          href="/meal-plan"
          icon={<ChefHat className="size-4" />}
          label="Meal plan"
        />
        <QuickAction
          href="/kitchen"
          icon={<Refrigerator className="size-4" />}
          label="Kitchen"
        />
        <QuickAction
          href="/progress"
          icon={<LineChart className="size-4" />}
          label="Progress"
        />
        <QuickAction
          href="/account"
          icon={<CreditCard className="size-4" />}
          label="Account"
        />
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6">
      {children}
    </section>
  );
}

function CardTitle({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: ChipTone;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 font-medium text-muted-foreground text-sm uppercase tracking-wide">
      <IconChip tone={tone}>{icon}</IconChip>
      {children}
    </h2>
  );
}

function EmptyHint({
  text,
  cta,
  href = "/",
}: {
  text: string;
  cta: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-sm">{text}</p>
      <Button asChild size="sm" variant="outline">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

function LockedCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border border-dashed bg-card p-6">
      <h2 className="mb-3 flex items-center gap-2.5 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
        {title}
      </h2>
      <div className="flex flex-1 flex-col items-start justify-center gap-3 py-4">
        <Lock className="size-5 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{text}</p>
        <Button asChild size="sm">
          <Link href="/account">Upgrade to Pro</Link>
        </Button>
      </div>
    </section>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-4 text-center text-sm transition-colors hover:bg-accent/50"
      href={href}
    >
      <span className="text-blood">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
