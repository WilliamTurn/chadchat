import { ChevronRight, Dumbbell, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { CountUp } from "@/components/dashboard/count-up";
import { KpiHelp } from "@/components/dashboard/kpi";
import { WorkoutsSkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { ScrollToHash } from "@/components/nav/scroll-to-hash";
import { StandaloneHeader } from "@/components/nav/standalone-header";
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
import { weekAnchors } from "@/lib/today/week";
import { parsePlanDays } from "@/lib/validation/plan-days";
import { parseTemplateExercises } from "@/lib/validation/workout-templates";
import { toWorkoutData } from "@/lib/workouts/serialize";
import {
  computePersonalRecords,
  exercise1RMTrend,
  lastSetsByExercise,
  prCountsByWorkout,
  volumeTrend,
  workoutVolumeLb,
} from "@/lib/workouts/stats";
import { MAX_WORKOUTS } from "./data";

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
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Build your workouts, run them live at the gym, and log every set.
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
        Upgrade to Pro to build your own workouts, run them live at the gym,
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
  const [rawWorkouts, rawTemplates, activePlans, customs] = await Promise.all([
    getWorkoutsByUserId(user.id, MAX_WORKOUTS),
    getWorkoutTemplatesByUserId(user.id),
    getActivePlansByUserId(user.id),
    getCustomExercisesByUserId(user.id),
  ]);

  const workouts = rawWorkouts.map(toWorkoutData);
  const lastSets = lastSetsByExercise(workouts);
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
  const planDays = trainingPlan ? parsePlanDays(trainingPlan.days) : null;

  const records = computePersonalRecords(workouts)
    .slice(0, 6)
    .map((r) => ({
      ...r,
      trend: exercise1RMTrend(workouts, r.exerciseName),
    }));
  const trend = volumeTrend(workouts);
  const prCounts = prCountsByWorkout(workouts);

  // "This week" = the member's current Sunday-start calendar week (LC-10).
  const weekStartMs = weekAnchors(user.timezone).days[0].getTime();
  const weekWorkouts = workouts.filter(
    (w) =>
      calendarDayAnchorInTz(new Date(w.performedAt), user.timezone).getTime() >=
      weekStartMs
  );
  const weekVolume = weekWorkouts.reduce(
    (sum, w) => sum + workoutVolumeLb(w),
    0
  );

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
            <StatCard label="Workouts logged" value={String(workouts.length)} />
            <StatCard
              help="Sessions you logged this calendar week, Sunday through Saturday, in your time zone. Resets every Sunday."
              label="This week"
              value={String(weekWorkouts.length)}
            />
            <StatCard
              help="Volume is the total weight you moved: weight times reps, added up across every set. This is your total for this calendar week, Sunday through Saturday."
              label="Volume this week"
              value={weekVolume > 0 ? `${weekVolume.toLocaleString()} lb` : "-"}
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
          days={planDays}
          lastSets={lastSets}
          planId={trainingPlan.id}
          planTitle={trainingPlan.title}
          unit={unit}
        />
      )}

      <StartEmptySection unit={unit} />

      {workouts.length > 0 && (
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

          {/* Recent history + the full log. id: dashboard "View all" target. */}
          <section id="history">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Recent workouts
              </h2>
              <div className="flex items-center gap-2">
                <AskChadButton prompt="Review my Workouts page: my logged sessions, weekly volume, training plan, and PRs. How is my training progressing overall, and what should I focus on next?" />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {workouts.slice(0, 5).map((w) => (
                <HistoryCard
                  key={w.id}
                  prCount={prCounts[w.id] ?? 0}
                  workout={w}
                />
              ))}
            </div>
            <Link
              className="mt-3 flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card font-semibold text-[14.5px] text-foreground transition hover:bg-muted/50"
              href="/workouts/history"
            >
              View all history ({workouts.length}{" "}
              {workouts.length === 1 ? "workout" : "workouts"})
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
