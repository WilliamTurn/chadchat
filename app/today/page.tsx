import {
  ArrowRight,
  ChefHat,
  Droplet,
  Dumbbell,
  LineChart,
  Lock,
  MessageSquare,
  Moon,
  Utensils,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { MacroRings } from "@/components/nutrition/macro-rings";
import { WeightChartInteractive } from "@/components/progress/weight-chart-interactive";
import { GoalList } from "@/components/today/goal-list";
import {
  ModuleCard,
  ModuleFooter,
  ModuleHeader,
} from "@/components/today/module-card";
import { PlanList } from "@/components/today/plan-list";
import { StatPills } from "@/components/today/stat-pills";
import { SleepTracker } from "@/components/today/sleep-tracker";
import { StreakStrip } from "@/components/today/streak-strip";
import { TargetEditor } from "@/components/today/target-editor";
import { WaterTracker } from "@/components/today/water-tracker";
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
  calendarDayAnchorInTz,
  formatCalendarDay,
  formatDayInTz,
  toCalendarDayISO,
  todayAnchorInTz,
  todayStartInTz,
} from "@/lib/date";
import type { ProgressEntry } from "@/lib/db/schema";
import { toPlanStatusSummary } from "@/lib/subscription";
import { normalizeSex, resolveHero } from "@/lib/today/goal-diagram";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/today/water-units";
import {
  buildLastNight,
  buildSleepWeek,
  buildWaterWeek,
  weekSlotDateLabel,
  weekSlotLabel,
} from "@/lib/today/week";
import { HeroCustomizer } from "@/components/today/hero-customizer";
import type { LiftProgress } from "@/components/today/goal-list";
import type { WorkoutWithChildren } from "@/lib/db/queries";
import { exercise1RMTrend, type WorkoutData } from "@/lib/workouts/stats";

const LB_PER_KG = 2.204_62;
const DAY_MS = 86_400_000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// How much workout history to hydrate for the /today lift-goal trends +
// last-workout card. Bounded and cheaper than the /workouts page's 200, but
// plenty for a strength-goal trend line.
const TODAY_WORKOUT_LIMIT = 60;

/** DB workout rows → the serializable shape the stats helpers consume. */
function toWorkoutData(w: WorkoutWithChildren): WorkoutData {
  return {
    id: w.id,
    title: w.title,
    performedAt: w.performedAt.toISOString(),
    durationSeconds: w.durationSeconds,
    notes: w.notes,
    exercises: w.exercises.map((ex) => ({
      name: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      notes: ex.notes,
      sets: ex.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        unit: s.unit,
        rpe: s.rpe,
        setType: s.setType,
        completed: s.completed,
      })),
    })),
  };
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

/** "Today" / "Yesterday" / "N days ago" / a short date, for the last-workout card
 *  — day boundaries on the user's own wall clock (FEAT-8). */
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

/** A daily calorie figure named in free text ("1,800 cal", "calories capped at
 *  1,800"), for the goal-vs-target coherence nudge (P2-4). Bounded to a sane
 *  daily range so gram counts and dates never match. */
function mentionedCalories(text: string): number | null {
  const m =
    text.match(/(\d[\d,]{2,4})\s*(?:k?cals?\b|calories?\b)/i) ??
    text.match(/\bcalories?\b[^.\d]{0,40}(\d[\d,]{2,4})/i);
  if (!m) {
    return null;
  }
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 800 && n <= 10_000 ? n : null;
}

/** Consecutive days (ending today or yesterday) with at least one logged action.
 *  Days are the user's local calendar days (FEAT-8) — a late-night log counts
 *  toward THEIR today, not the next UTC day. */
function computeStreak(dates: Date[], timezone: string | null): number {
  if (dates.length === 0) {
    return 0;
  }
  const days = new Set(
    dates.map((d) => toCalendarDayISO(calendarDayAnchorInTz(d, timezone)))
  );
  let cursor = todayAnchorInTz(timezone);
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
    <PageShell>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />
      <StandaloneHeader active="/today" />
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
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }
  // First-run onboarding (ONB-1): a new member with access hasn't set up yet —
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
  const todayAnchor = todayAnchorInTz(timezone);

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
    isPro ? getWaterDailyTotals(user.id, timezone) : Promise.resolve([]),
    getActiveGoalsByUserId(user.id),
    getInactiveGoalsByUserId(user.id),
    getActivePlansByUserId(user.id),
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

  // Active meal plan summary for the /today card.
  const mealPlanSummary = mealPlan
    ? {
        title: mealPlan.title,
        dayCount: Array.isArray(mealPlan.days) ? mealPlan.days.length : 0,
        // Plain nouns, not lifter shorthand like "200P / 190C / 65F" (P3-5).
        targetLine:
          mealPlan.targetCalories != null
            ? `${mealPlan.targetCalories.toLocaleString()} cal · ${mealPlan.targetProtein ?? 0}g protein · ${mealPlan.targetCarbs ?? 0}g carbs · ${mealPlan.targetFat ?? 0}g fat`
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
    metricRef: g.metricRef,
    startValue: g.startValue,
    targetValue: g.targetValue,
    unit: g.unit,
  });
  const goalItems = goals.map(toGoalItem);
  const pastGoalItems = pastGoals.map(toGoalItem);

  // Coherence nudges (P2-4): (a) an active goal whose text names a daily
  // calorie figure that disagrees with the Calorie Tracker target, and (b) two
  // active goals tracking the same metric, whose progress bars anchor on
  // different start values and so can contradict each other on one screen.
  let calorieConflict: {
    goalTitle: string;
    mentioned: number;
    target: number;
  } | null = null;
  if (target?.calories) {
    for (const g of goalItems) {
      const mentioned = mentionedCalories(`${g.title} ${g.detail ?? ""}`);
      if (mentioned != null && mentioned !== target.calories) {
        calorieConflict = {
          goalTitle: g.title,
          mentioned,
          target: target.calories,
        };
        break;
      }
    }
  }

  const overlapIds: string[] = [];
  {
    // Only metrics where two goals genuinely measure the same thing: weight,
    // body fat, or the same lift. Two "measurement" goals can be different
    // body parts, and "custom" goals have no comparable metric.
    const byMetric = new Map<string, string[]>();
    for (const g of goalItems) {
      if (g.metric === "weight" || g.metric === "bodyfat") {
        byMetric.set(g.metric, [...(byMetric.get(g.metric) ?? []), g.id]);
      } else if (g.metric === "lift" && g.metricRef) {
        const key = `lift:${g.metricRef.trim().toLowerCase()}`;
        byMetric.set(key, [...(byMetric.get(key) ?? []), g.id]);
      }
    }
    for (const ids of byMetric.values()) {
      if (ids.length > 1) {
        overlapIds.push(...ids);
      }
    }
  }

  // Lift goals (DSH-28): read the est.-1RM trend for each tracked exercise from
  // the logged workouts, so the goal card shows live progress + charts against
  // the PR data already collected. Exercise names double as add-a-goal
  // suggestions.
  const workoutData = recentWorkouts.map(toWorkoutData);
  const exerciseNames = [
    ...new Map(
      workoutData
        .flatMap((w) => w.exercises.map((ex) => ex.name.trim()))
        .filter(Boolean)
        .map((name) => [name.toLowerCase(), name] as const)
    ).values(),
  ].sort((a, b) => a.localeCompare(b));

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
  // Daily hydration goal (DSH-24): user-set in ml, else one gallon.
  const waterGoalMl = user.waterGoalMl ?? DEFAULT_WATER_GOAL_ML;

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
  // All day math runs on the user's local calendar days (00:00-UTC anchors).
  const streak = computeStreak(activityDays, timezone);
  const activeDayKeys = new Set(
    activityDays.map((d) => toCalendarDayISO(calendarDayAnchorInTz(d, timezone)))
  );
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayAnchor.getTime() - (6 - i) * DAY_MS);
    return {
      label: weekSlotLabel(d, i === 6),
      dateLabel: weekSlotDateLabel(d),
      active: activeDayKeys.has(toCalendarDayISO(d)),
      isToday: i === 6,
    };
  });
  const activeThisWeek = week.filter((d) => d.active).length;

  // Sleep + hydration week strips — the compact in-card readouts (the full
  // history charts live on /sleep and /hydration; one surface per domain).
  const lastNight = buildLastNight(latestSleep, timezone);
  const sleepWeek = buildSleepWeek(sleepDaily, timezone);
  const waterWeek = buildWaterWeek(waterDaily, timezone);

  // First-run: a brand-new member with no profile and nothing logged yet. We
  // show a "welcome / get started" header instead of "Welcome back" (which is
  // illogical the very first time they sign in), the hero carries the page's
  // ONE dominant first action (P1-4), and the empty cards state what will
  // appear instead of each shouting its own CTA.
  const isReturning =
    Boolean(profile) || entries.length > 0 || todaysMeals.length > 0;
  const firstRun = !isReturning;

  // "Thursday, July 2" on the member's own wall clock (R2-11) — the page says
  // "today" everywhere, so it should say WHICH day that is.
  const todayLabel = formatDayInTz(new Date(), timezone, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 lg:pr-64">
        <div
          aria-hidden
          className="-right-16 -top-16 pointer-events-none absolute size-56 rounded-full bg-blood/25 blur-3xl"
        />
        {/* Brand hero figure (DSH-21/DSH-29) — decorative, confined to its own
            clipped right column with a left-fading mask so it can never overlap
            the stat pills, streak strip, or CTA (the lg:pr-64 gutter above keeps
            the content clear of this column). A built-in silhouette bleeds up
            from the bottom; a user photo fills the column. Plain <img> (not
            next/image) so the proxy serves it on this authenticated route;
            hidden below lg where the header stacks. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-60 overflow-hidden lg:block"
        >
          {hero.kind === "custom" ? (
            <img
              alt=""
              aria-hidden
              className="h-full w-full select-none object-cover opacity-80 [mask-image:linear-gradient(to_left,black_55%,transparent)]"
              src={hero.src}
            />
          ) : (
            <img
              alt=""
              aria-hidden
              // h-full, not an over-100% bleed: bleeding the figure above the
              // container clipped its head off (DSH-37).
              className="absolute right-0 bottom-0 h-full w-auto max-w-none select-none object-contain object-bottom opacity-90 [mask-image:linear-gradient(to_left,black_45%,transparent)]"
              src={hero.src}
            />
          )}
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              {isReturning ? "Welcome back" : "Welcome to Chad"} · {todayLabel}
            </p>
            <h1 className="mt-1 font-display font-bold text-3xl tracking-tight sm:text-4xl">
              {firstName ?? (isReturning ? "Let's work" : "Let's get started")}
            </h1>
            <p className="mt-2 max-w-md text-muted-foreground text-sm">
              {isReturning
                ? "Here's where you stand today. No excuses — just the numbers."
                : "One thing first: tell Chad about yourself. He'll set your targets and build your plan, and this page fills in as you log."}
            </p>
            {/* First-run (P1-4): the page's ONE dominant action. Every other
                empty state below stays quiet so this is the obvious next step. */}
            {firstRun && (
              <Button asChild className="mt-4 gap-2" size="lg">
                <Link
                  href={`/?prompt=${encodeURIComponent(
                    "I'm new here. Ask me what you need to know about me, then set up my targets and my plan."
                  )}`}
                >
                  <MessageSquare className="size-4" />
                  Tell Chad about yourself
                </Link>
              </Button>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {plan.tier === "elite" ? (
              <Badge
                className="gap-1 border-foreground/30 bg-foreground/10 px-2.5 font-semibold uppercase tracking-wide"
                variant="secondary"
              >
                <Zap className="size-3" fill="currentColor" />
                Elite
              </Badge>
            ) : plan.tier === "pro" ? (
              <Badge
                className="gap-1 border-blood/40 bg-blood/15 px-2.5 font-semibold text-blood uppercase tracking-wide shadow-[0_0_12px_-2px_var(--color-blood)]"
                variant="secondary"
              >
                <Zap className="size-3" fill="currentColor" />
                Pro
              </Badge>
            ) : plan.status === "trialing" && plan.trialDaysLeft !== null ? (
              <Badge variant="secondary">
                {plan.trialDaysLeft <= 0
                  ? "Trial ends today"
                  : `${plan.trialDaysLeft} days left in trial`}
              </Badge>
            ) : (
              <Badge variant="secondary">Basic</Badge>
            )}
            {/* Hidden on first-run: the hero's big CTA is the one action. */}
            {!firstRun && (
              <Button asChild className="gap-1.5" size="sm">
                <Link href="/">
                  <MessageSquare className="size-3.5" />
                  Talk to Chad
                </Link>
              </Button>
            )}
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
        <ModuleCard>
          <ModuleHeader
            icon={<Utensils className="size-4" />}
            title="Calorie Tracker"
            tone="amber"
            viewHref="/nutrition#history"
          />
          <div className="mt-2">
            <MacroRings
              caloriesConsumed={caloriesToday}
              caloriesTarget={target?.calories ?? null}
              carbsConsumed={carbsToday}
              carbsTarget={target?.carbs ?? null}
              emptyCta={
                // First-run keeps this quiet (P1-4): the hero owns the one CTA
                // and Chad sets targets from the intro chat anyway.
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
            status={
              todaysMeals.length > 0
                ? `${todaysMeals.length} meal${todaysMeals.length === 1 ? "" : "s"} logged today`
                : "No meals logged yet today."
            }
          >
            <AskChadButton prompt="Look at what I've eaten today and how it stacks up against my calorie and macro targets. Am I on track, and what should I eat for the rest of the day?" />
            <TargetEditor
              calories={target?.calories ?? null}
              carbs={target?.carbs ?? null}
              fat={target?.fat ?? null}
              protein={target?.protein ?? null}
            />
            <Button asChild className="gap-1.5" size="sm" variant="outline">
              <Link href="/nutrition#log-meal">
                Log a meal
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </ModuleFooter>
        </ModuleCard>
      ) : (
        <LockedCard
          icon={<Utensils className="size-4" />}
          text="Snap a meal, fridge, or pantry and Chad grades the macros, then tracks your calories and protein against a daily target. Pro only."
          title="Calorie Tracker"
        />
      )}

      {/* Hydration + Sleep (Pro) — the other daily loggers, right under the
          calorie tracker so "am I on track today?" is answerable from the top
          of the page (audit rule 4: STATUS → LOGGERs → PLANs → REVIEW). */}
      <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
        {isPro ? (
          <WaterTracker
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
            last={lastNight}
            quiet={firstRun}
            viewHref="/sleep"
            week={sleepWeek}
          />
        ) : (
          <LockedCard
            icon={<Moon className="size-4" />}
            text="Log how you sleep each night and Chad factors recovery into your training. Pro only."
            title="Sleep & recovery"
          />
        )}
      </div>

      {/* Goal + Training — one consistent card treatment (DSH-30: the goals card
          no longer floats detailed anatomy art behind the text; the header
          silhouette is now the page's single body-visualization style). */}
      <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
        <ModuleCard>
          <GoalList
            calorieConflict={calorieConflict}
            currentWeight={currentWeight}
            exerciseNames={exerciseNames}
            goals={goalItems}
            liftProgress={liftProgress}
            memoryGoalHint={goal}
            overlapIds={overlapIds}
            pastGoals={pastGoalItems}
            quiet={firstRun}
          />
        </ModuleCard>

        <ModuleCard>
          <PlanList
            memoryPlanHint={workoutPlan}
            plans={planItems}
            quiet={firstRun}
          />
        </ModuleCard>
      </div>

      {/* Last workout + Meal plan (Pro) — Basic members get the same locked
          teasers as every other Pro module (P2-7: one gating rule, locked
          cards sell the upgrade; invisible rows don't). */}
      {isPro ? (
        <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
          <ModuleCard>
            <ModuleHeader
              icon={<Dumbbell className="size-4" />}
              title="Last workout"
              tone="blood"
              viewHref="/workouts#history"
            />
            {lastWorkout ? (
              <div className="flex flex-1 flex-col justify-center">
                <div className="font-display font-semibold text-lg leading-tight">
                  {lastWorkout.title}
                </div>
                <div className="mt-0.5 text-muted-foreground text-sm">
                  {relativeDay(lastWorkout.performedAt, timezone)} ·{" "}
                  {lastWorkout.exerciseCount} exercise
                  {lastWorkout.exerciseCount === 1 ? "" : "s"} ·{" "}
                  {lastWorkout.setCount} set
                  {lastWorkout.setCount === 1 ? "" : "s"}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No workouts logged yet. Log your first session and Chad starts
                tracking your PRs and volume.
              </p>
            )}
            <ModuleFooter>
              <AskChadButton prompt="Look at my recent workouts. What's working, what's lagging, and what should I hit next session?" />
              <Button asChild className="gap-1.5" size="sm" variant="outline">
                <Link href="/workouts">
                  Log a workout
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </ModuleFooter>
          </ModuleCard>

          <ModuleCard>
            <ModuleHeader
              icon={<ChefHat className="size-4" />}
              title="Meal plan"
              tone="amber"
              viewHref={mealPlanSummary ? "/meal-plan" : undefined}
              viewLabel="View plan"
            />
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
              <p className="text-muted-foreground text-sm">
                No meal plan yet. Have Chad build a structured plan around your
                macro target — real foods, exact portions.
              </p>
            )}
            <ModuleFooter>
              <AskChadButton
                prompt={
                  mealPlanSummary
                    ? "Walk me through my meal plan. What am I eating today, and what can I swap if I'm missing something?"
                    : "Should I be on a structured meal plan for my goal? What would you put in one for me?"
                }
              />
              <Button asChild className="gap-1.5" size="sm" variant="outline">
                <Link href="/meal-plan">
                  {mealPlanSummary ? "Open plan" : "Build a meal plan"}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </ModuleFooter>
          </ModuleCard>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
          <LockedCard
            icon={<Dumbbell className="size-4" />}
            text="Log your workouts and Chad tracks your PRs, volume, and what to hit next session. Pro only."
            title="Last workout"
          />
          <LockedCard
            icon={<ChefHat className="size-4" />}
            text="Chad builds a structured meal plan around your macro target. Real foods, exact portions. Pro only."
            title="Meal plan"
          />
        </div>
      )}

      {/* Weight trend (Pro) — the REVIEW finale: the slow metric the product's
          promise hangs on gets the page's one full-width chart. */}
      {isPro ? (
        <ModuleCard>
          <ModuleHeader
            icon={<LineChart className="size-4" />}
            title="Weight trend"
            tone="violet"
            viewHref="/progress"
          />
          {currentWeight != null && (
            <div className="flex items-baseline gap-2">
              <span className="font-display font-semibold text-lg leading-none">
                {currentWeight} {displayUnit}
              </span>
              {weightChange != null && (
                <span className="text-muted-foreground text-xs">
                  {weightChange > 0 ? "+" : ""}
                  {weightChange} {displayUnit} since your first weigh-in
                </span>
              )}
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
          <ModuleFooter>
            <AskChadButton prompt="Look at my weight trend and how it's tracking against my goal weight. Am I moving in the right direction, and should I change anything?" />
            <Button asChild className="gap-1.5" size="sm" variant="outline">
              <Link href="/progress#log-entry">
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

      {/* No quick-actions row (P2-8): it duplicated the top nav incompletely,
          and the mobile sheet nav already covers reach. */}
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

