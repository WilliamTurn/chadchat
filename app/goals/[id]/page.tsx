import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { GoalDoc } from "@/components/today/goal-doc";
import type { LiftProgress } from "@/components/today/goal-list";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getGoalById,
  getProgressEntriesByUserId,
  getUserById,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import { latestWeightInUnit } from "@/lib/goals/latest-weight";
import {
  distinctExerciseNames,
  toWorkoutData,
} from "@/lib/workouts/serialize";
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
    <PageShell>
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
        <BackToDashboard href="/goals" label="Your goals" />
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
    targetValue: goal.targetValue,
    unit: goal.unit,
  };

  // Progress anchors, hydrated only when this goal can use them.
  const isPro = canAccessProFeatures(user);
  const needsWeight = isPro && goal.metric === "weight";
  const needsLift = isPro && goal.metric === "lift" && goal.metricRef;

  const [entries, recentWorkouts] = await Promise.all([
    needsWeight ? getProgressEntriesByUserId(user.id) : Promise.resolve([]),
    needsLift
      ? getWorkoutsByUserId(user.id, DOC_WORKOUT_LIMIT)
      : Promise.resolve([]),
  ]);

  const currentWeight =
    latestWeightInUnit(entries, user.weightUnit)?.value ?? null;

  const workoutData = recentWorkouts.map(toWorkoutData);
  const exerciseNames = distinctExerciseNames(workoutData);
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
      currentWeight={currentWeight}
      exerciseNames={exerciseNames}
      goal={goalItem}
      lift={lift}
    />
  );
}
