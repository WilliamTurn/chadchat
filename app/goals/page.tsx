import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { GoalList, type LiftProgress } from "@/components/today/goal-list";
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
import { formatDayInTzSmartYear } from "@/lib/date";
import { findCalorieConflict, findOverlapIds } from "@/lib/goals/coherence";
import { trendWeightInUnit } from "@/lib/goals/latest-weight";
import { clientField } from "@/lib/memory/client-field";
import { getResolveOptions } from "@/lib/workouts/canonical";
import {
  canonicalizeWorkouts,
  resolveExerciseIdentity,
} from "@/lib/workouts/exercise-identity";
import { toWorkoutData } from "@/lib/workouts/serialize";
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
    // Full-width desktop layout (LAY-1): the wide frame, filled with a real
    // multi-column goal grid instead of one centered card column.
    <PageShell active="/goals" className="max-w-[1500px]">

      <div className="mb-8">
        <BackToDashboard />
        <h1 className="font-semibold text-2xl tracking-tight">Goals</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          All of your goals in one place: live progress on the active ones,
          your past goals, and the full write-ups. Chad reads these in every
          chat and holds you to them.
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
  // Legal gate (BLK-4): accept the Terms before using the product.
  if (!user.acceptedTermsAt) {
    redirect("/legal");
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
    currentValue: g.currentValue,
    targetValue: g.targetValue,
    unit: g.unit,
    // Anchors relative deadlines like "8 weeks" on the card (LC-5).
    createdAtLabel: formatDayInTzSmartYear(g.createdAt, user.timezone),
  });
  const goalItems = goals.map(toGoalItem);
  const pastGoalItems = pastGoals.map(toGoalItem);

  // Same anchors the /today card uses, so the two surfaces never disagree.
  // "Current" is the smoothed trend weight — the canonical number (LC-4).
  const currentWeight =
    trendWeightInUnit(entries, user.weightUnit)?.value ?? null;

  // Canonical inputs + a canonicalized ref, so this page's lift values are
  // the SAME series /today and /progress read through buildGoalVM (P56-Z
  // adversarial P1-1: raw-history math here diverged from the canonical
  // surfaces once FIX-33 landed, and alias-spelled refs missed entirely).
  const resolveOptions = await getResolveOptions(user.id);
  const workoutData = canonicalizeWorkouts(
    recentWorkouts.map(toWorkoutData),
    resolveOptions
  );
  const liftProgress: Record<string, LiftProgress> = {};
  for (const g of goalItems) {
    if (g.metric === "lift" && g.metricRef) {
      const points = exercise1RMTrend(
        workoutData,
        resolveExerciseIdentity(g.metricRef, resolveOptions).canonicalName
      );
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
    <GoalList
      calorieConflict={calorieConflict}
      currentWeight={currentWeight}
      goals={goalItems}
      layout="page"
      liftProgress={liftProgress}
      memoryGoalHint={memoryGoalHint}
      overlapIds={overlapIds}
      pastGoals={pastGoalItems}
    />
  );
}
