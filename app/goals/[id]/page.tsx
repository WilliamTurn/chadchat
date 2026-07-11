import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import {
  GoalDoc,
  type GoalCoherence,
  type GoalWeightChart,
} from "@/components/today/goal-doc";
import type { LiftProgress } from "@/components/today/goal-list";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getActiveGoalsByUserId,
  getGoalById,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getUserById,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import {
  mentionedCalories,
  overlapTitlesFor,
} from "@/lib/goals/coherence";
import { formatDayInTzSmartYear } from "@/lib/date";
import {
  latestWeightInUnit,
  toDisplayWeight,
  trendWeightInUnit,
  weightPointsInUnit,
} from "@/lib/goals/latest-weight";
import { toWorkoutData } from "@/lib/workouts/serialize";
import { exercise1RMTrend } from "@/lib/workouts/stats";

/**
 * The full-page goal document (R2-9): one goal's write-up, live progress, and
 * lift chart on its own page instead of a cramped dialog, following the
 * meal-plan page pattern. Owner-scoped; anyone else's id is a 404.
 */

const DOC_WORKOUT_LIMIT = 60;

export default function GoalDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    // Full-width desktop layout (LAY-1): document column + sticky actions
    // rail (the two-column split lives inside GoalDoc).
    <PageShell className="max-w-[1500px]">
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />

      {/* usePathname inside the header is runtime data on a dynamic route, so
          it needs its own Suspense boundary under Cache Components. */}
      <Suspense fallback={null}>
        <StandaloneHeader active="/goals" />
      </Suspense>

      <div className="mb-8">
        <BackToDashboard href="/goals" label="Goals" />
        <h1 className="font-semibold text-2xl tracking-tight">Goal</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          The full write-up, your live progress, and everything you can do with
          it.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <GoalDocContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function GoalDocContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const goal = await getGoalById({ id, userId: user.id });
  if (!goal) {
    notFound();
  }

  const goalItem = {
    id: goal.id,
    title: goal.title,
    detail: goal.detail,
    targetDate: goal.targetDate,
    status: goal.status,
    metric: goal.metric,
    metricRef: goal.metricRef,
    startValue: goal.startValue,
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    unit: goal.unit,
    // Anchors relative deadlines like "8 weeks" on the page (LC-5).
    createdAtLabel: formatDayInTzSmartYear(goal.createdAt, user.timezone),
  };

  // Progress anchors, hydrated only when this goal can use them.
  const isPro = canAccessProFeatures(user);
  const needsWeight = isPro && goal.metric === "weight";
  const needsLift = isPro && goal.metric === "lift" && goal.metricRef;
  const isActive = goal.status === "active";

  const [entries, recentWorkouts, activeGoals, target] = await Promise.all([
    needsWeight ? getProgressEntriesByUserId(user.id) : Promise.resolve([]),
    needsLift
      ? getWorkoutsByUserId(user.id, DOC_WORKOUT_LIMIT)
      : Promise.resolve([]),
    isActive ? getActiveGoalsByUserId(user.id) : Promise.resolve([]),
    isActive && isPro ? getNutritionTarget(user.id) : Promise.resolve(undefined),
  ]);

  const latest = latestWeightInUnit(entries, user.weightUnit);
  // "Current" is the smoothed trend weight — the canonical number (LC-4).
  const currentWeight =
    trendWeightInUnit(entries, user.weightUnit)?.value ?? null;

  // A weight goal gets the full interactive weight trend re-plotted against
  // its own goal line + projected finish date (VF-6), in the display unit.
  let weightChart: GoalWeightChart | null = null;
  if (needsWeight) {
    const displayUnit = latest?.unit ?? user.weightUnit ?? "lb";
    weightChart = {
      points: weightPointsInUnit(entries, displayUnit),
      unit: displayUnit,
      goalWeight:
        goal.targetValue != null
          ? toDisplayWeight(goal.targetValue, goal.unit, displayUnit)
          : null,
      goalStartWeight:
        goal.startValue != null
          ? toDisplayWeight(goal.startValue, goal.unit, displayUnit)
          : null,
    };
  }

  // Coherence detail for THIS goal (VF-4): the /today and /goals cards show one
  // quiet line; the full explanation lives here on the goal's own page.
  const mentioned = isActive
    ? mentionedCalories(`${goal.title} ${goal.detail ?? ""}`)
    : null;
  const coherence: GoalCoherence | null = isActive
    ? {
        calorie:
          mentioned != null &&
          target?.calories != null &&
          mentioned !== target.calories
            ? { mentioned, target: target.calories }
            : null,
        overlapTitles: overlapTitlesFor(goalItem, activeGoals),
      }
    : null;

  const workoutData = recentWorkouts.map(toWorkoutData);
  let lift: LiftProgress | null = null;
  if (needsLift && goal.metricRef) {
    const points = exercise1RMTrend(workoutData, goal.metricRef);
    lift = {
      current: points.at(-1)?.value ?? null,
      first: points[0]?.value ?? null,
      points,
    };
  }

  return (
    <GoalDoc
      coherence={coherence}
      currentWeight={currentWeight}
      goal={goalItem}
      lift={lift}
      weightChart={weightChart}
    />
  );
}
