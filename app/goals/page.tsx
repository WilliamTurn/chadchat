import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { GoalList, type LiftProgress } from "@/components/today/goal-list";
import { ModuleCard } from "@/components/today/module-card";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getActiveGoalsByUserId,
  getInactiveGoalsByUserId,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getUserById,
  getUserMemory,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import { findCalorieConflict, findOverlapIds } from "@/lib/goals/coherence";
import { latestWeightInUnit } from "@/lib/goals/latest-weight";
import { clientField } from "@/lib/memory/client-field";
import {
  distinctExerciseNames,
  toWorkoutData,
} from "@/lib/workouts/serialize";
import { exercise1RMTrend } from "@/lib/workouts/stats";

/**
 * The dedicated Goals page (R2-8): goals' ONE deep surface, following the
 * /sleep and /hydration pattern. Every domain had a full page except the thing
 * the whole product is aimed at. Active goals with live progress and lift
 * charts, past goals, the editor, and the coherence nudges, with the /today
 * card keeping the compact list + "View all →".
 */

// Matches the /today hydration bound: enough history for a real e1RM trend.
const GOALS_WORKOUT_LIMIT = 60;

export default function GoalsPage() {
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

      <StandaloneHeader active="/goals" />

      <div className="mb-8">
        <BackToDashboard />
        <h1 className="font-semibold text-2xl tracking-tight">Your goals</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Everything you're chasing, in one place: live progress on the active
          goals, your past goals, and the full write-ups. Chad sees these in
          every chat and holds you to them.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <GoalsContent />
      </Suspense>
    </PageShell>
  );
}

async function GoalsContent() {
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

  const [goals, pastGoals, memory, target, recentWorkouts, entries] =
    await Promise.all([
      getActiveGoalsByUserId(user.id),
      getInactiveGoalsByUserId(user.id),
      getUserMemory(user.id),
      isPro ? getNutritionTarget(user.id) : Promise.resolve(undefined),
      isPro
        ? getWorkoutsByUserId(user.id, GOALS_WORKOUT_LIMIT)
        : Promise.resolve([]),
      isPro ? getProgressEntriesByUserId(user.id) : Promise.resolve([]),
    ]);

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

  // Same anchors the /today card uses, so the two surfaces never disagree.
  const currentWeight =
    latestWeightInUnit(entries, user.weightUnit)?.value ?? null;

  const workoutData = recentWorkouts.map(toWorkoutData);
  const exerciseNames = distinctExerciseNames(workoutData);
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

  const calorieConflict = findCalorieConflict(goalItems, target?.calories);
  const overlapIds = findOverlapIds(goalItems);
  const memoryGoalHint = clientField(memory?.profile ?? null, "Primary goal");

  return (
    <ModuleCard>
      <GoalList
        calorieConflict={calorieConflict}
        currentWeight={currentWeight}
        exerciseNames={exerciseNames}
        goals={goalItems}
        liftProgress={liftProgress}
        memoryGoalHint={memoryGoalHint}
        overlapIds={overlapIds}
        pastGoals={pastGoalItems}
      />
    </ModuleCard>
  );
}
