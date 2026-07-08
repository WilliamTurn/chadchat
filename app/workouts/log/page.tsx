import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { WorkoutsSkeleton } from "@/components/dashboard/page-skeletons";
import { RewardProvider } from "@/components/dashboard/reward";
import { SessionLogger } from "@/components/workouts/logger/session-logger";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getCustomExercisesByUserId,
  getPlanById,
  getUserById,
  getWorkoutById,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import { parsePlanDays } from "@/lib/validation/plan-days";
import { buildPlanPrefill } from "@/lib/workouts/plan-prefill";
import { toWorkoutData } from "@/lib/workouts/serialize";
import {
  lastSetsByExercise,
  prBaselineByExercise,
  workoutVolumeLb,
} from "@/lib/workouts/stats";

/**
 * The dedicated full-page workout logger (MOB-18): members log, run plan
 * days, repeat, and edit sessions on an entire page, never in a popup, with
 * exercise picking inline as a page view. Modes via query params:
 *   /workouts/log             → log a fresh session
 *   /workouts/log?repeat=<id> → same exercises again, values ghosted
 *   /workouts/log?edit=<id>   → correct an already-saved workout
 *   /workouts/log?plan=<id>&day=<n> → run a training plan's day n
 */

// Same history window the Workouts page uses: PR baselines and ghosts are
// computed from it.
const MAX_WORKOUTS = 200;
// Sessions the "volume vs your recent average" summary line averages over.
const RECENT_VOLUME_WINDOW = 8;

export default function WorkoutLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string;
    repeat?: string;
    plan?: string;
    day?: string;
  }>;
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
      {/* usePathname inside the header is runtime data on a page with
          searchParams, so it needs its own Suspense boundary under Cache
          Components. */}
      <Suspense fallback={null}>
        <StandaloneHeader active="/workouts" />
      </Suspense>

      <Suspense fallback={<WorkoutsSkeleton />}>
        <LoggerContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function LoggerContent({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string;
    repeat?: string;
    plan?: string;
    day?: string;
  }>;
}) {
  const params = await searchParams;
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
  // The Workouts page carries the upgrade pitch; the logger just points there.
  if (!canAccessProFeatures(user)) {
    redirect("/workouts");
  }

  const [rawWorkouts, customExercisesRaw] = await Promise.all([
    getWorkoutsByUserId(user.id, MAX_WORKOUTS),
    getCustomExercisesByUserId(user.id),
  ]);
  const workouts = rawWorkouts.map(toWorkoutData);
  const customExercises = customExercisesRaw.map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
    kind: e.kind,
    notes: e.notes,
  }));
  const lastSets = lastSetsByExercise(workouts);
  const prBaseline = prBaselineByExercise(workouts);
  const recentVolumes = workouts
    .slice(0, RECENT_VOLUME_WINDOW)
    .map(workoutVolumeLb);

  // Resolve the mode. Bad ids/params 404 rather than silently opening an
  // empty logger under a misleading URL.
  let mode: "create" | "edit" | "repeat" | "plan" = "create";
  let initial: ReturnType<typeof toWorkoutData> | undefined;
  let plan: ReturnType<typeof buildPlanPrefill> | undefined;

  if (params.edit || params.repeat) {
    const id = params.edit ?? params.repeat;
    if (!id) {
      notFound();
    }
    const record = await getWorkoutById({ id, userId: user.id }).catch(
      () => null
    );
    if (!record) {
      notFound();
    }
    initial = toWorkoutData(record);
    mode = params.edit ? "edit" : "repeat";
  } else if (params.plan != null) {
    const record = await getPlanById({ id: params.plan, userId: user.id });
    const days = record ? parsePlanDays(record.days) : null;
    const dayIndex = Number(params.day ?? "");
    if (
      !record ||
      !days ||
      !Number.isInteger(dayIndex) ||
      dayIndex < 0 ||
      dayIndex >= days.length
    ) {
      notFound();
    }
    plan = buildPlanPrefill(days[dayIndex], customExercises, lastSets);
    mode = "plan";
  }

  const heading =
    mode === "edit"
      ? "Edit workout"
      : mode === "repeat"
        ? "Repeat workout"
        : mode === "plan"
          ? (plan?.title ?? "Run plan day")
          : "Log a workout";
  const sub =
    mode === "edit"
      ? "Fix anything about this saved session. Every change updates your PRs and volume."
      : mode === "repeat"
        ? "Same exercises as last time. Your previous numbers are ghosted in: check a set off to accept them, or type what you did."
        : mode === "plan"
          ? "Your plan day, ready to run. Check sets off as you train."
          : "Every set, rep, and pound. Want the session timed? Tap play on the clock. Logging a past workout? Just type it in.";

  return (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
      {/* The page header renders INSIDE the logger so each view (log, add
          exercises, create custom) shows exactly ONE header and ONE back
          path — never two stacked page headers (owner report, s171). */}
      <SessionLogger
        customExercises={customExercises}
        heading={heading}
        initial={initial}
        lastSets={lastSets}
        mode={mode}
        plan={plan}
        prBaseline={prBaseline}
        recentVolumes={recentVolumes}
        sub={sub}
      />
    </RewardProvider>
  );
}
