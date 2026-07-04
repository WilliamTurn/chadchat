import { Dumbbell, Plus, Repeat, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { ScrollToHash } from "@/components/nav/scroll-to-hash";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { CountUp } from "@/components/dashboard/count-up";
import { KpiHelp } from "@/components/dashboard/kpi";
import { WorkoutsSkeleton } from "@/components/dashboard/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RewardProvider } from "@/components/dashboard/reward";
import { PersonalRecords } from "@/components/workouts/personal-records";
import { PlanRunner } from "@/components/workouts/plan-runner";
import { VolumeChart } from "@/components/workouts/volume-chart";
import { WorkoutBuilder } from "@/components/workouts/workout-builder";
import { WorkoutCard } from "@/components/workouts/workout-card";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { calendarDayAnchorInTz } from "@/lib/date";
import {
  getActivePlansByUserId,
  getCustomExercisesByUserId,
  getUserById,
  getWorkoutsByUserId,
  type WorkoutWithChildren,
} from "@/lib/db/queries";
import { weekAnchors } from "@/lib/today/week";
import { parsePlanDays } from "@/lib/validation/plan-days";
import {
  computePersonalRecords,
  exercise1RMTrend,
  type LastExerciseLog,
  lastSetsByExercise,
  type WorkoutData,
  workoutVolumeLb,
  volumeTrend,
} from "@/lib/workouts/stats";

// Cap the history we hydrate per page load. Generous (years of training at a
// session a day) but bounds an otherwise unbounded query + payload as a user's
// log grows. PRs and the volume trend are computed from this window.
const MAX_WORKOUTS = 200;

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
      kind: ex.kind,
      supersetGroup: ex.supersetGroup,
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

export default function WorkoutsPage() {
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
      <StandaloneHeader active="/workouts" />

      <div className="mb-8">
        <BackToDashboard />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Workouts</h1>
          {/* "Pro feature", not bare "Pro": the badge labels the FEATURE's
              tier; a bare tier name reads as the member's own plan (LC-13). */}
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Log every set, rep, and pound. Chad tracks your PRs and volume — and
          holds you to them.
        </p>
      </div>

      <Suspense fallback={<WorkoutsSkeleton />}>
        <WorkoutsContent />
      </Suspense>
    </PageShell>
  );
}

async function WorkoutsContent() {
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

  if (!canAccessProFeatures(user)) {
    return <UpgradePrompt />;
  }

  return (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
      <Dashboard timezone={user.timezone} userId={user.id} />
    </RewardProvider>
  );
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">Workout logging is a Chad Pro feature</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to log your training set by set, build an exercise
        library, and watch your strength and volume climb — the stuff a real
        coach tracks for you.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

async function Dashboard({
  userId,
  timezone,
}: {
  userId: string;
  timezone: string | null;
}) {
  const [rawWorkouts, customExercisesRaw, activePlans] = await Promise.all([
    getWorkoutsByUserId(userId, MAX_WORKOUTS),
    getCustomExercisesByUserId(userId),
    getActivePlansByUserId(userId),
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

  // The current training plan, runnable from this page (FN-2). `days` is the
  // structured program; null means an older free-text plan — PlanRunner
  // backfills it via a one-time AI extraction.
  const trainingPlan = activePlans.find((p) => p.kind === "training") ?? null;
  const planDays = trainingPlan ? parsePlanDays(trainingPlan.days) : null;

  // Last session's numbers per exercise, ghosted into the logger.
  const lastSets = lastSetsByExercise(workouts);

  const records = computePersonalRecords(workouts)
    .slice(0, 6)
    .map((r) => ({
      ...r,
      trend: exercise1RMTrend(workouts, r.exerciseName),
    }));
  const trend = volumeTrend(workouts);

  // "This week" = the member's current Sunday-start calendar week (LC-10) —
  // the same week the dashboard strips and the /today "Days active this week"
  // stat show, so every "week" number in the app answers the same question.
  // (These stats used to be a rolling last-7-days window, which the label
  // contradicted.)
  const weekStartMs = weekAnchors(timezone).days[0].getTime();
  const weekWorkouts = workouts.filter(
    (w) =>
      calendarDayAnchorInTz(new Date(w.performedAt), timezone).getTime() >=
      weekStartMs
  );
  const weekVolume = weekWorkouts.reduce((sum, w) => sum + workoutVolumeLb(w), 0);

  return (
    <div className="flex flex-col gap-8">
      <ScrollToHash />
      {/* Action + summary. On mobile the primary CTA comes first and spans the
          full width instead of wrapping alone onto a second line (VF-9). */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {workouts.length > 0 && (
            <AskChadButton prompt="Review my Workouts page: my logged sessions, weekly volume, training plan, and PRs. How is my training progressing overall, and what should I focus on next?" />
          )}
          {workouts.length > 0 && (
            <WorkoutBuilder
              customExercises={customExercises}
              initial={workouts[0]}
              lastSets={lastSets}
              mode="repeat"
              trigger={
                <Button className="gap-1.5" variant="outline">
                  <Repeat className="size-4" />
                  Repeat last
                </Button>
              }
            />
          )}
          <WorkoutBuilder
            customExercises={customExercises}
            lastSets={lastSets}
            mode="create"
            trigger={
              <Button className="order-first w-full gap-1.5 sm:order-none sm:w-auto">
                <Plus className="size-4" />
                Log a workout
              </Button>
            }
          />
        </div>

        {workouts.length > 0 && (
          // DSH-27: after logging a workout the page refetches (revalidatePath +
          // router.refresh), so the chart and PRs update — but the count-up
          // counters kept the old total until a manual reload. Keying the block
          // on the live figures remounts the StatCards whenever they change, so
          // the numbers can't go stale (and re-count to the new total as feedback).
          <div
            className="grid gap-2 sm:grid-cols-3 sm:gap-3"
            key={`${workouts.length}-${weekWorkouts.length}-${weekVolume}`}
          >
            <StatCard label="Workouts" value={String(workouts.length)} />
            <StatCard
              help="Sessions you logged this calendar week, Sunday through Saturday, in your time zone. Resets every Sunday."
              label="This week"
              value={String(weekWorkouts.length)}
            />
            <StatCard
              help="Volume is the total weight you moved: weight times reps, added up across every set. This is your total for this calendar week, Sunday through Saturday."
              label="Volume this week"
              value={weekVolume > 0 ? `${weekVolume.toLocaleString()} lb` : "—"}
            />
          </div>
        )}
      </div>

      {/* The active training plan, runnable (FN-2). Rendered even before the
          first workout — "plan generated, nothing logged yet" is exactly when
          Start-a-day matters most. */}
      {trainingPlan && (
        <PlanRunner
          customExercises={customExercises}
          days={planDays}
          lastSets={lastSets}
          planId={trainingPlan.id}
          planTitle={trainingPlan.title}
        />
      )}

      {workouts.length === 0 ? (
        <EmptyState customExercises={customExercises} lastSets={lastSets} />
      ) : (
        <>
          {/* Volume trend */}
          {trend.length >= 2 && <VolumeChart points={trend} />}

          {/* Personal records */}
          {records.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
                <Trophy className="size-4 text-amber-500" />
                Personal records
                <KpiHelp label="Personal records">
                  Your best performance on each lift. "est. 1RM" is your
                  estimated one-rep max: the heaviest single rep you could
                  likely manage, calculated from a set's weight and reps. It
                  lets a 225 x 5 day and a 245 x 2 day be compared on one
                  scale. Tap a lift to see its strength trend over time.
                </KpiHelp>
              </h2>
              <PersonalRecords records={records} />
            </section>
          )}

          {/* History. id: the dashboard card's "View all" landing spot (R2-5). */}
          <section id="history">
            <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              History
            </h2>
            <div className="flex flex-col gap-4">
              {workouts.map((w) => (
                <WorkoutCard
                  customExercises={customExercises}
                  key={w.id}
                  lastSets={lastSets}
                  workout={w}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * One summary stat inside a card so the top-of-page numbers match the chart
 * KPIs rather than reading as three bare figures. On mobile it's a full-width
 * row (label left, number right) — three side-by-side tiles at 390px wrapped
 * "6,880 lb" mid-value (VF-9); on sm+ it keeps the Kpi column treatment.
 * `help` attaches the shared "?" popover next to the label (HLP-1).
 */
function StatCard({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0 sm:py-3.5">
      <div className="order-2 whitespace-nowrap font-semibold text-lg tracking-tight tabular-nums sm:order-1 sm:text-2xl">
        <CountUp value={value} />
      </div>
      <div className="order-1 flex items-center gap-1 text-muted-foreground text-xs sm:order-2 sm:mt-0.5">
        {label}
        {help && <KpiHelp label={label}>{help}</KpiHelp>}
      </div>
    </div>
  );
}

function EmptyState({
  customExercises,
  lastSets,
}: {
  customExercises: {
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string;
    kind: string;
    notes: string | null;
  }[];
  lastSets: Record<string, LastExerciseLog>;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/50">
        <Dumbbell className="size-6 text-blood" />
      </span>
      <div>
        <h3 className="font-medium text-lg">No workouts logged yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground text-sm">
          Log your first session — every set, rep, and weight. Chad will start
          tracking your PRs and volume the moment you do.
        </p>
      </div>
      <WorkoutBuilder
        customExercises={customExercises}
        lastSets={lastSets}
        mode="create"
        trigger={
          <Button className="gap-1.5">
            <Plus className="size-4" />
            Log your first workout
          </Button>
        }
      />
    </div>
  );
}
