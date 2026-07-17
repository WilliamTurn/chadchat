import { ChevronRight, Dumbbell, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { KpiHelp } from "@/components/dashboard/kpi";
import {
  MetricValue,
  type MetricScope,
} from "@/components/dashboard/metric-value";
import type { UnitId } from "@/lib/contracts/units";
import { WorkoutsSkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { ScrollToHash } from "@/components/nav/scroll-to-hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toCustomExerciseData } from "@/components/workouts/v2/catalog";
import { HistoryCard } from "@/components/workouts/v2/history-card";
import {
  ChadPlanSection,
  IntroCard,
  MyWorkoutsSection,
  ResumeCard,
  StartEmptySection,
  type TemplateData,
} from "@/components/workouts/v2/workouts-home";
import { PersonalRecords } from "@/components/workouts/personal-records";
import { VolumeChart } from "@/components/workouts/volume-chart";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { calendarDayAnchorInTz } from "@/lib/date";
import {
  getActivePlansByUserId,
  getCustomExercisesByUserId,
  getUserById,
  getWorkoutsByUserId,
  getWorkoutTemplatesByUserId,
} from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { resolvePlanScheduleView } from "@/lib/db/plan-goal-queries";
import { weekAnchors } from "@/lib/today/week";
import { parseTemplateExercises } from "@/lib/validation/workout-templates";
import { getApprovedExerciseAliases } from "@/lib/workouts/alias-queries";
import { canonicalizeWorkouts } from "@/lib/workouts/exercise-identity";
import { getWorkoutHeaders } from "@/lib/workouts/training-data";
import { toWorkoutData } from "@/lib/workouts/serialize";
import {
  computePersonalRecords,
  exercise1RMTrend,
  lastSetsByExercise,
  prCountsByWorkout,
  prEventsByWorkout,
  volumeTrend,
} from "@/lib/workouts/stats";
import {
  volumeSinceLb,
  withAliasKeyEchoes,
} from "@/lib/workouts/training-analytics";
import { MAX_WORKOUTS } from "./data";

export default function WorkoutsPage() {
  return (
    // Full-width desktop layout (LAY-1): the wide frame, filled with
    // multi-column workout/plan card grids and a paired analytics row.
    <PageShell active="/workouts" className="max-w-[1500px]">
      <div className="mb-8">
        <BackToDashboard />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Workouts</h1>
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Build your workouts, run them live, and log every set.
          Chad tracks your PRs and volume, and holds you to them.
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
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }
  if (!canAccessProFeatures(user)) {
    return <UpgradePrompt />;
  }

  return <Home user={user} />;
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">Workouts are a Chad Pro feature</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to build your own workouts, run them live,
        and watch your strength and volume climb. That's what a real coach
        tracks for you.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

async function Home({ user }: { user: User }) {
  const [
    rawWorkouts,
    rawTemplates,
    activePlans,
    customs,
    memberAliases,
    workoutHeaders,
  ] = await Promise.all([
    getWorkoutsByUserId(user.id, MAX_WORKOUTS),
    getWorkoutTemplatesByUserId(user.id),
    getActivePlansByUserId(user.id),
    getCustomExercisesByUserId(user.id),
    getApprovedExerciseAliases(user.id),
    getWorkoutHeaders(user.id),
  ]);
  // training.sessions.total: the UNCAPPED count, same source as
  // /progress/training, never the page-capped hydration slice.
  const totalSessions = workoutHeaders.length;

  const workouts = rawWorkouts.map(toWorkoutData);
  // FIX-33: analytics (records, trends, PR counts) read canonicalized
  // history so aliases merge; ghost/baseline maps echo raw keys so the
  // logger's raw-name lookups keep hitting (read-time only, no row rewrites).
  const resolveOptions = {
    memberCustomNames: customs.map((c) => c.name),
    memberAliases,
  };
  const canonicalWorkouts = canonicalizeWorkouts(workouts, resolveOptions);
  const lastSets = withAliasKeyEchoes(
    lastSetsByExercise(canonicalWorkouts),
    workouts,
    resolveOptions
  );
  const customExercises = customs.map(toCustomExerciseData);
  const unit = user.weightUnit === "kg" ? ("kg" as const) : ("lb" as const);

  const templates: TemplateData[] = rawTemplates.flatMap((t) => {
    const exercises = parseTemplateExercises(t.exercises);
    if (!exercises) {
      return [];
    }
    return [
      {
        id: t.id,
        name: t.name,
        exercises,
        lastPerformedAt: t.lastPerformedAt ? t.lastPerformedAt.getTime() : null,
      },
    ];
  });

  const trainingPlan = activePlans.find((p) => p.kind === "training") ?? null;
  // FIX-28: the one resolved schedule (materialized lazily from legacy days
  // json); document view = text-only plan, the section offers the one-tap
  // extraction as before.
  const planScheduleView = trainingPlan
    ? await resolvePlanScheduleView(trainingPlan)
    : null;
  const planSessions =
    planScheduleView && planScheduleView.kind !== "document"
      ? planScheduleView.schedule.sessions
      : null;

  const records = computePersonalRecords(canonicalWorkouts)
    .slice(0, 6)
    .map((r) => ({
      ...r,
      trend: exercise1RMTrend(canonicalWorkouts, r.exerciseName),
    }));
  const trend = volumeTrend(canonicalWorkouts, user.timezone);
  const prCounts = prCountsByWorkout(canonicalWorkouts);
  // Gold-dot markers for the drill-down chart: est-1RM record sessions from
  // the SAME replay that backs the history-card pills (one computation).
  const prMarkers: Record<string, number[]> = {};
  for (const e of prEventsByWorkout(canonicalWorkouts)) {
    if (!e.beatE1rm) {
      continue;
    }
    const t = new Date(e.performedAt).getTime();
    const list = (prMarkers[e.exerciseName] ??= []);
    if (!list.includes(t)) {
      list.push(t);
    }
  }

  // "This week" = the member's current Sunday-start calendar week (LC-10).
  const { days: weekDays, todayMs } = weekAnchors(user.timezone);
  const weekStartMs = weekDays[0].getTime();
  const weekWorkouts = workouts.filter(
    (w) =>
      calendarDayAnchorInTz(new Date(w.performedAt), user.timezone).getTime() >=
      weekStartMs
  );
  // Registered training.volume.week: one symbol here and on Progress >
  // Training, so the two surfaces can never disagree (FIX-33).
  const weekVolume = volumeSinceLb(canonicalWorkouts, weekStartMs, user.timezone);

  return (
    <div className="flex flex-col gap-8 pb-24">
      <ScrollToHash />

      <div className="flex flex-col gap-4">
        <ResumeCard />
        <IntroCard />

        {workouts.length > 0 && (
          <div
            className="grid gap-2 sm:grid-cols-3 sm:gap-3"
            key={`${workouts.length}-${weekWorkouts.length}-${weekVolume}`}
          >
            <StatCard
              label="Workouts logged"
              scope="all time"
              unit="count"
              value={totalSessions}
            />
            <StatCard
              help="Workouts you logged this calendar week, Sunday through Saturday, in your time zone. Resets every Sunday."
              label="Workouts"
              scope="this week"
              unit="count"
              value={weekWorkouts.length}
            />
            <StatCard
              help="Volume is the total weight you moved: weight times reps, added up across every set. This is your total for this calendar week, Sunday through Saturday."
              label="Volume"
              scope="this week"
              unit="lb"
              value={weekVolume}
            />
          </div>
        )}
      </div>

      {/* The member's own workouts, the headline feature. */}
      <MyWorkoutsSection lastSets={lastSets} templates={templates} unit={unit} />

      {/* Chad's plan, startable the same way. */}
      {trainingPlan && (
        <ChadPlanSection
          customExercises={customExercises}
          lastSets={lastSets}
          planId={trainingPlan.id}
          planTitle={trainingPlan.title}
          sessions={planSessions}
          unit={unit}
        />
      )}

      <StartEmptySection unit={unit} />

      {workouts.length > 0 && (
        <>
          {/* Volume trend + personal records, paired side by side on desktop
              (LAY-1). Explicit grid-cols-1 + min-w-0 children: without them
              the implicit column sizes to max-content and phones/tablets get
              silently clipped under overflow-x: clip. */}
          {(trend.length >= 2 || records.length > 0) && (
            <div
              className={`grid grid-cols-1 items-start gap-8 ${
                trend.length >= 2 && records.length > 0 ? "xl:grid-cols-2" : ""
              }`}
            >
              {/* Volume trend */}
              {trend.length >= 2 && (
                <div className="min-w-0">
                  <VolumeChart points={trend} todayMs={todayMs} />
                </div>
              )}

              {/* Personal records */}
              {records.length > 0 && (
                <section className="min-w-0">
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
                  <PersonalRecords
                    prMarkers={prMarkers}
                    records={records}
                    todayMs={todayMs}
                  />
                </section>
              )}
            </div>
          )}

          {/* Recent history + the full log. id: dashboard "View all" target. */}
          <section className="scroll-mt-20" id="history">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Recent workouts
              </h2>
              <div className="flex items-center gap-2">
                <AskChadButton prompt="Review my Workouts page: my logged sessions, weekly volume, training plan, and PRs. How is my training progressing overall, and what should I focus on next?" />
              </div>
            </div>
            {/* Two-across on desktop (LAY-1); explicit grid-cols-1 + min-w-0
                so the implicit column never sizes to max-content. Columns
                start at lg: at 768 the sidebar leaves ~512px of content and
                half-width cards clip their best-set line. */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {workouts.slice(0, 5).map((w) => (
                <div className="min-w-0" key={w.id}>
                  <HistoryCard prCount={prCounts[w.id] ?? 0} workout={w} />
                </div>
              ))}
            </div>
            <Link
              className="mt-3 flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card font-semibold text-[14.5px] text-foreground transition hover:bg-muted/50"
              href="/workouts/history"
            >
              View all history ({totalSessions}{" "}
              {totalSessions === 1 ? "workout" : "workouts"})
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </section>

          {/* The full exercise library, one tap away. */}
          <Link
            className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 font-semibold text-[15px] text-foreground transition hover:bg-muted/50"
            href="/workouts/exercises"
          >
            <span className="flex items-center gap-2.5">
              <Dumbbell aria-hidden className="size-5 text-blood" />
              Exercise library: your records and progress for every exercise
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0" />
          </Link>
        </>
      )}

      {workouts.length === 0 && (
        <Link
          className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 font-semibold text-[15px] text-foreground transition hover:bg-muted/50"
          href="/workouts/exercises"
        >
          <span className="flex items-center gap-2.5">
            <Dumbbell aria-hidden className="size-5 text-blood" />
            Browse the exercise library
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0" />
        </Link>
      )}
    </div>
  );
}

/** One workouts-home stat, on the shared scope-required MetricValue (RC-8).
 *  The bordered tile and its mobile row / desktop column order are unchanged;
 *  MetricValue supplies the canonically formatted number and its scope. */
function StatCard({
  label,
  value,
  unit,
  scope,
  help,
}: {
  label: string;
  value: number;
  unit: UnitId;
  scope: MetricScope;
  help?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0 sm:py-3.5">
      <MetricValue
        captionClassName="order-1 sm:order-2 sm:mt-0.5"
        help={help}
        label={label}
        layout="pieces"
        scope={scope}
        unit={unit}
        value={value}
        valueClassName="order-2 text-lg sm:order-1 sm:text-2xl"
      />
    </div>
  );
}
